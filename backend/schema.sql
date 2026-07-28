-- DDL schema for ITLC Kerala Event Registration System (MySQL)

CREATE DATABASE IF NOT EXISTS itlc;
USE itlc;

DROP TABLE IF EXISTS app_settings;

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(255) PRIMARY KEY,
    setting_value LONGTEXT NULL,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1. App Counters Table
CREATE TABLE IF NOT EXISTS app_counters (
    id VARCHAR(36) PRIMARY KEY,
    counter_name VARCHAR(255) NOT NULL UNIQUE,
    counter_value INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_app_counters_name (counter_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- 2. Members Table
CREATE TABLE IF NOT EXISTS members (
    id VARCHAR(36) PRIMARY KEY,
    salutation VARCHAR(50) NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    professional_phone VARCHAR(50) NULL,
    personal_phone VARCHAR(50) NULL,
    email VARCHAR(255) NOT NULL,
    professional_email VARCHAR(255) NULL,
    personal_email VARCHAR(255) NULL,
    designation VARCHAR(255) NULL,
    company VARCHAR(255) NULL,
    industry_sector VARCHAR(255) NULL,
    industry_type VARCHAR(255) NULL,
    industry_category VARCHAR(255) NULL,
    industry_sub_category VARCHAR(255) NULL,
    country_of_work VARCHAR(255) NULL,
    location VARCHAR(255) NULL,
    itlc_chapter_name VARCHAR(255) NULL,
    years_of_experience VARCHAR(50) NULL,
    date_of_birth VARCHAR(50) NULL,
    area_of_expertise VARCHAR(255) NULL,
    profile_image LONGTEXT NULL, -- Holds base64 data url or public file path
    membership_tier VARCHAR(50) DEFAULT 'Standard',
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    login_pin VARCHAR(4) NULL,
    reset_pin VARCHAR(6) NULL,
    reset_pin_expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_phone (phone_number),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Events Table
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    date VARCHAR(50) NOT NULL,
    time VARCHAR(100) NULL,
    location VARCHAR(255) NULL,
    address VARCHAR(255) NULL,
    max_registrations INT DEFAULT 0,
    fee DECIMAL(10, 2) DEFAULT 0.00,
    auto_share BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'upcoming', -- 'upcoming', 'past', 'cancelled'
    image LONGTEXT NULL, -- Holds base64 data url or public file path
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_event_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Event Registrations Table
CREATE TABLE IF NOT EXISTS event_registrations (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL,
    member_id VARCHAR(36) NULL,
    registration_type VARCHAR(50) DEFAULT 'member', -- 'member', 'non_member'
    guest_name VARCHAR(255) NULL,
    guest_designation VARCHAR(255) NULL,
    guest_email VARCHAR(255) NULL,
    guest_phone VARCHAR(50) NULL,
    guest_salutation VARCHAR(50) NULL,
    guest_company VARCHAR(255) NULL,
    guest_industry_sector VARCHAR(255) NULL,
    guest_industry_type VARCHAR(255) NULL,
    guest_industry_category VARCHAR(255) NULL,
    guest_industry_sub_category VARCHAR(255) NULL,
    guest_country_of_work VARCHAR(255) NULL,
    guest_location VARCHAR(255) NULL,
    guest_years_of_experience VARCHAR(50) NULL,
    guest_date_of_birth VARCHAR(50) NULL,
    guest_area_of_expertise VARCHAR(255) NULL,
    guest_profile_image LONGTEXT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status VARCHAR(50) DEFAULT 'not_required', -- 'not_required', 'pending', 'paid', 'failed'
    payment_id VARCHAR(100) NULL,
    payment_amount DECIMAL(10, 2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_reg_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
    CONSTRAINT fk_reg_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE SET NULL,
    KEY idx_reg_event (event_id),
    KEY idx_reg_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Event Attendance Table
CREATE TABLE IF NOT EXISTS event_attendance (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL,
    member_id VARCHAR(36) NULL,
    registration_id VARCHAR(36) NULL,
    guest_name VARCHAR(255) NULL,
    guest_phone VARCHAR(50) NULL,
    checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_in_method VARCHAR(50) DEFAULT 'self_checkin', -- 'self_checkin', 'admin_checkin'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_att_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
    CONSTRAINT fk_att_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE SET NULL,
    CONSTRAINT fk_att_registration FOREIGN KEY (registration_id) REFERENCES event_registrations (id) ON DELETE SET NULL,
    KEY idx_att_event (event_id),
    KEY idx_att_member (member_id),
    KEY idx_att_registration (registration_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Member Edit History Table
CREATE TABLE IF NOT EXISTS member_edit_history (
    id VARCHAR(36) PRIMARY KEY,
    member_id VARCHAR(36) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value LONGTEXT NULL,
    new_value LONGTEXT NULL,
    changed_by VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_hist_member FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
    KEY idx_hist_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP VIEW IF EXISTS event_counters;

-- 7. Event Counters Table
CREATE TABLE IF NOT EXISTS event_counters (
    event_id VARCHAR(36) PRIMARY KEY,
    registration_count INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cnt_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

