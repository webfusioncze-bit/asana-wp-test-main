<?php
/**
 * Plugin Name: Asana Task Manager
 * Plugin URI: https://example.com/asana-task-manager
 * Description: Plnohodnotný task management systém s Asana-like designem, podporou subtasků, komentářů, složek a email notifikací
 * Version: 1.0.0
 * Author: Your Name
 * Author URI: https://example.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: asana-task-manager
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

define('ATM_VERSION', '1.0.0');
define('ATM_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ATM_PLUGIN_URL', plugin_dir_url(__FILE__));
define('ATM_PLUGIN_FILE', __FILE__);

class AsanaTaskManager {
    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();
        $this->init_hooks();
    }

    private function load_dependencies() {
        require_once ATM_PLUGIN_DIR . 'includes/class-atm-supabase.php';
        require_once ATM_PLUGIN_DIR . 'includes/class-atm-api.php';
        require_once ATM_PLUGIN_DIR . 'includes/class-atm-shortcodes.php';
        require_once ATM_PLUGIN_DIR . 'includes/class-atm-admin.php';
        require_once ATM_PLUGIN_DIR . 'includes/class-atm-notifications.php';
        require_once ATM_PLUGIN_DIR . 'includes/class-atm-ajax.php';
    }

    private function init_hooks() {
        add_action('init', array($this, 'load_textdomain'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));

        register_activation_hook(ATM_PLUGIN_FILE, array($this, 'activate'));
        register_deactivation_hook(ATM_PLUGIN_FILE, array($this, 'deactivate'));
    }

    public function load_textdomain() {
        load_plugin_textdomain('asana-task-manager', false, dirname(plugin_basename(ATM_PLUGIN_FILE)) . '/languages');
    }

    public function enqueue_scripts() {
        if (!is_user_logged_in()) {
            return;
        }

        wp_enqueue_style('atm-app', ATM_PLUGIN_URL . 'assets/build/main.css', array(), ATM_VERSION);

        wp_enqueue_script('atm-app', ATM_PLUGIN_URL . 'assets/build/main.js', array(), ATM_VERSION, true);

        $current_user = wp_get_current_user();

        wp_localize_script('atm-app', 'atmConfig', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('atm_nonce'),
            'supabaseUrl' => get_option('atm_supabase_url', ''),
            'supabaseAnonKey' => get_option('atm_supabase_anon_key', ''),
            'currentUser' => array(
                'id' => $current_user->ID,
                'email' => $current_user->user_email,
                'displayName' => $current_user->display_name,
            ),
        ));
    }

    public function admin_enqueue_scripts($hook) {
        if (strpos($hook, 'asana-task-manager') === false) {
            return;
        }

        wp_enqueue_style('atm-admin', ATM_PLUGIN_URL . 'assets/admin/admin.css', array(), ATM_VERSION);
        wp_enqueue_script('atm-admin', ATM_PLUGIN_URL . 'assets/admin/admin.js', array('jquery'), ATM_VERSION, true);
    }

    public function activate() {
        flush_rewrite_rules();
    }

    public function deactivate() {
        flush_rewrite_rules();
    }
}

function atm() {
    return AsanaTaskManager::get_instance();
}

atm();
