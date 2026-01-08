<?php
// Handle AJAX request for saving performance data
add_action('wp_ajax_save_performance_data', 'wf_save_performance_data');
add_action('wp_ajax_nopriv_save_performance_data', 'wf_save_performance_data');
function wf_save_performance_data() {
    global $wpdb;
    $load_time = isset($_POST['load_time']) ? floatval($_POST['load_time']) : 0;
    $url = isset($_POST['url']) ? $_POST['url'] : 'unknown';

    // Nová data
    $device = isset($_POST['device']) ? sanitize_text_field($_POST['device']) : 'unknown';
    $country = isset($_POST['country']) ? sanitize_text_field($_POST['country']) : 'unknown';

    // Uložení dat do tabulky
    $wpdb->insert(
        $wpdb->prefix . 'performance_data',
        array(
            'load_time' => $load_time,
            'url' => $url,
            'device' => $device,
            'country' => $country,
        ),
        array('%f', '%s', '%s', '%s')
    );

    wp_die(); // This is required to terminate immediately and return a proper response
}

// REST API endpoint to get performance data
add_action('rest_api_init', function () {
    register_rest_route('webfusion/v1', '/performance', array(
        'methods' => 'GET',
        'callback' => 'wf_get_performance_data',
    ));
});

function wf_get_performance_data(WP_REST_Request $request) {
    global $wpdb;
    $results = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}performance_data ORDER BY time DESC", ARRAY_A);
    return new WP_REST_Response($results, 200);
}
