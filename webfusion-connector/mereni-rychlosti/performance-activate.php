<?php
function wf_create_performance_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'performance_data';  // Dynamicky vytvoří název tabulky se správným prefixem

    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        time datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        load_time float NOT NULL,
        url varchar(255) NOT NULL,
        device varchar(10) NOT NULL,  -- Nový sloupec pro zařízení
        country varchar(3) NOT NULL,  -- Nový sloupec pro zemi
        PRIMARY KEY (id)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}
register_activation_hook(__FILE__, 'wf_create_performance_table');
?>
