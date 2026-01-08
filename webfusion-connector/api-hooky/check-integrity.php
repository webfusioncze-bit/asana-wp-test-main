<?php
require_once(ABSPATH . 'wp-admin/includes/file.php');

function wbf_connector_check_wp_integrity(WP_REST_Request $request) {
    $auth = wbf_connector_verify_api_key($request);
    if (is_wp_error($auth)) {
        return $auth;
    }

    $checksums = wp_get_core_checksums(get_bloginfo('version'));
    if (!$checksums) {
        return new WP_REST_Response('Could not retrieve checksums', 500);
    }

    $integrity_issues = array();

    foreach ($checksums as $file => $checksum) {
        $file_path = ABSPATH . $file;
        if (!file_exists($file_path)) {
            $integrity_issues[] = "$file is missing";
        } elseif (md5_file($file_path) !== $checksum) {
            $integrity_issues[] = "$file is corrupted";
        }
    }

    // Kontrola nadbytečných souborů
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(ABSPATH));
    foreach ($files as $file) {
        if ($file->isFile() && strpos($file->getPathname(), 'wp-content') === false) {
            $relative_path = str_replace(ABSPATH, '', $file->getPathname());
            if (!isset($checksums[$relative_path])) {
                $integrity_issues[] = "$relative_path is an unexpected file";
            }
        }
    }

    if (empty($integrity_issues)) {
        return new WP_REST_Response('All core files are intact', 200);
    } else {
        return new WP_REST_Response($integrity_issues, 500);
    }
}

register_rest_route('webfusion-connector/v1', '/check-integrity', array(
    'methods' => 'POST',
    'callback' => 'wbf_connector_check_wp_integrity',
));
