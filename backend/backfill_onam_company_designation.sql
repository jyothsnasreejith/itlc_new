-- ============================================================
-- BACKFILL SCRIPT: Fix company & designation in onam_registrations
-- Compatible with MySQL 5.7+ (no REGEXP_REPLACE needed)
-- Uses RIGHT(phone, 10) to match last 10 digits regardless of
-- whether stored as 9876543210, +919876543210, or 919876543210
-- ============================================================

-- ─── STEP 1: DRY RUN — Preview what will change ──────────────
-- Run this first (safe read-only). No data is modified.

SELECT
    o.id              AS registration_id,
    o.primary_name,
    o.phone_number    AS onam_phone,
    o.company         AS current_company,
    o.designation     AS current_designation,
    m.company         AS real_company,
    m.designation     AS real_designation
FROM onam_registrations o
JOIN members m
    ON RIGHT(m.phone_number, 10) COLLATE utf8mb4_unicode_ci
     = RIGHT(o.phone_number, 10) COLLATE utf8mb4_unicode_ci
WHERE o.attendee_type = 'member'
  AND m.status = 'approved'
ORDER BY o.id;


-- ─── STEP 2: EXECUTE UPDATE ───────────────────────────────────
-- After confirming the dry run looks correct, run this UPDATE.

UPDATE onam_registrations o
JOIN members m
    ON RIGHT(m.phone_number, 10) COLLATE utf8mb4_unicode_ci
     = RIGHT(o.phone_number, 10) COLLATE utf8mb4_unicode_ci
SET
    o.company     = COALESCE(NULLIF(TRIM(m.company), ''),     o.company),
    o.designation = COALESCE(NULLIF(TRIM(m.designation), ''), o.designation)
WHERE o.attendee_type = 'member'
  AND m.status = 'approved';


-- ─── STEP 3: VERIFY ───────────────────────────────────────────
-- Confirm all member rows now have real company & designation.

SELECT
    id,
    primary_name,
    phone_number,
    company,
    designation,
    total_payable,
    DATE_FORMAT(
        CONVERT_TZ(created_at, '+00:00', '+05:30'),
        '%d/%m/%Y %h:%i %p'
    ) AS created_ist
FROM onam_registrations
WHERE attendee_type = 'member'
ORDER BY created_at ASC;
