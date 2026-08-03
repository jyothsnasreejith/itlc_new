<?php
/**
 * DYNAMIC IMAGE UPLOADER FOR ITLC KERALA
 * Saves images inside public_html/itlc/ under separate subfolders:
 * - members/           (for member profiles)
 * - events/            (for event banners)
 * - guests/            (for guest registrations)
 * - uploads/           (fallback general upload folder)
 * 
 * Supports both standard multipart/form-data files and JSON base64 payloads.
 */

// Set CORS headers so that external apps (like Node/Express/Vercel) can upload
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, apikey");
header("Content-Type: application/json");

// Handle OPTIONS preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Reject non-POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "error" => "Method not allowed. Only POST uploads are supported."]);
    exit;
}

// Get the base URL where this script is accessed from
$protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? "https" : "http";
$host = $_SERVER['HTTP_HOST'];

// Detect script directory: e.g. /itlc/upload.php -> /itlc
$request_uri = $_SERVER['REQUEST_URI'];
$script_path = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
$script_path = rtrim($script_path, '/');
$base_url = $protocol . "://" . $host . $script_path;

// Helper to sanitize filenames to prevent path traversals and odd characters
function sanitize_filename($filename) {
    // Strip path info
    $filename = basename($filename);
    // Remove non-alphanumeric, dot, dash, underscore
    return preg_replace('/[^a-zA-Z0-9\-\._]/', '', $filename);
}

// Determine targeted subfolder
$folder = isset($_POST['folder']) ? $_POST['folder'] : (isset($_GET['folder']) ? $_GET['folder'] : 'members');

// If folder is guests or uploads, map it to members
if ($folder === 'guests' || $folder === 'uploads') {
    $folder = 'members';
}

// Restrict folder names for security (members and events only)
if (!in_array($folder, ['members', 'events'])) {
    $folder = 'members';
}

// Ensure the folder exists and set up CORS .htaccess
if (!file_exists($folder)) {
    mkdir($folder, 0755, true);
}
if (!file_exists($folder . '/.htaccess')) {
    @file_put_contents($folder . '/.htaccess', "<IfModule mod_headers.c>\nHeader set Access-Control-Allow-Origin \"*\"\n</IfModule>\n");
}

// --- 1. Handle JSON/Base64 Payload ---
$json_input = json_decode(file_get_contents('php://input'), true);
if (json_last_error() === JSON_ERROR_NONE) {
    if (isset($json_input['base64']) && isset($json_input['filename'])) {
        $base64_str = $json_input['base64'];
        $filename = sanitize_filename($json_input['filename']);
        
        if (isset($json_input['folder'])) {
            $folder = $json_input['folder'];
            if ($folder === 'guests' || $folder === 'uploads') {
                $folder = 'members';
            }
            if (!in_array($folder, ['members', 'events'])) {
                $folder = 'members';
            }
        }
        
        // Re-verify folder path exists
        if (!file_exists($folder)) {
            mkdir($folder, 0755, true);
        }

        // Clean prefix if it is a Data URL (e.g. data:image/jpeg;base64,...)
        if (preg_match('/^data:image\/(\w+);base64,/', $base64_str, $matches)) {
            $base64_str = substr($base64_str, strpos($base64_str, ',') + 1);
        }
        
        $decoded_data = base64_decode($base64_str);
        if ($decoded_data === false) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Invalid base64 payload data."]);
            exit;
        }

        $file_path = $folder . '/' . $filename;
        if (file_put_contents($file_path, $decoded_data) !== false) {
            echo json_encode([
                "success" => true,
                "url" => $base_url . '/' . $file_path,
                "path" => $file_path
            ]);
            exit;
        } else {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => "Failed to write base64 file to disk."]);
            exit;
        }
    }
}

// --- 2. Handle standard Multipart Form Upload ---
if (isset($_FILES['file'])) {
    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "File upload error code: " . $file['error']]);
        exit;
    }

    $filename = sanitize_filename($file['name']);
    
    // Auto-detect folder by prefix if not specifically set to events
    if ($folder !== 'events') {
        if (stripos($filename, 'event') !== false) {
            $folder = 'events';
        } else {
            $folder = 'members';
        }
    }

    // Re-verify folder path exists
    if (!file_exists($folder)) {
        mkdir($folder, 0755, true);
    }

    $target_path = $folder . '/' . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $target_path)) {
        echo json_encode([
            "success" => true,
            "url" => $base_url . '/' . $target_path,
            "path" => $target_path
        ]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to move uploaded file to target folder."]);
        exit;
    }
}

http_response_code(400);
echo json_encode(["success" => false, "error" => "No file or base64 data received."]);
?>
