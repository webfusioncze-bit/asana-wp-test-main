<?php
add_filter( 'pre_set_site_transient_update_plugins', 'check_for_plugin_update' );
function check_for_plugin_update( $checked_data ) {

    if ( empty( $checked_data->checked ) ) {
        return $checked_data;
    }

    $api_url  = 'https://portal.webfusion.cz/connector-plugin/updater.php';
    $response = wp_remote_get( $api_url );

    if ( ! is_wp_error( $response ) && wp_remote_retrieve_response_code( $response ) === 200 ) {
        $data = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( is_array( $data ) && isset( $data['new_version'] ) ) {
            $plugin_path = 'webfusion-connector/web-status-feed.php';

            if ( isset( $checked_data->checked[ $plugin_path ] )
                 && version_compare( $data['new_version'], $checked_data->checked[ $plugin_path ], '>' ) ) {

                // WP očekává objekt, proto cast
                $checked_data->response[ $plugin_path ] = (object) $data;
            }
        }
    }

    return $checked_data;
}

add_filter( 'auto_update_plugin', 'auto_update_specific_plugins', 10, 2 );
function auto_update_specific_plugins( $update, $item ) {

    // $item->slug nemusí existovat
    if ( property_exists( $item, 'slug' ) && $item->slug === 'webfusion-connector' ) {
        return true;   // povolit automatickou aktualizaci jen tohoto pluginu
    }

    return $update;    // ostatní nech na WordPressu
}
?>
