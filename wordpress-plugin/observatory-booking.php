<?php
/**
 * Plugin Name: Observatory Booking System
 * Plugin URI: https://github.com/your-repo/observatory-booking
 * Description: A comprehensive booking system for observatory telescope reservations
 * Version: 1.0.0
 * Author: Observatory Booking Team
 * License: GPL v2 or later
 * Text Domain: observatory-booking
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('OBSERVATORY_BOOKING_VERSION', '1.0.0');
define('OBSERVATORY_BOOKING_PLUGIN_URL', plugin_dir_url(__FILE__));
define('OBSERVATORY_BOOKING_PLUGIN_PATH', plugin_dir_path(__FILE__));

class ObservatoryBookingPlugin {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_shortcode('observatory_booking', array($this, 'booking_shortcode'));
        add_action('wp_ajax_observatory_booking_api', array($this, 'handle_api_request'));
        add_action('wp_ajax_nopriv_observatory_booking_api', array($this, 'handle_api_request'));
        add_action('admin_menu', array($this, 'admin_menu'));
    }
    
    public function init() {
        // Create database tables if they don't exist
        $this->create_tables();
    }
    
    public function enqueue_scripts() {
        wp_enqueue_script(
            'observatory-booking-app',
            OBSERVATORY_BOOKING_PLUGIN_URL . 'assets/js/booking-app.js',
            array('jquery'),
            OBSERVATORY_BOOKING_VERSION,
            true
        );
        
        wp_enqueue_style(
            'observatory-booking-style',
            OBSERVATORY_BOOKING_PLUGIN_URL . 'assets/css/booking-app.css',
            array(),
            OBSERVATORY_BOOKING_VERSION
        );
        
        // Localize script with API endpoint
        wp_localize_script('observatory-booking-app', 'observatoryBooking', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('observatory_booking_nonce'),
            'apiUrl' => get_option('observatory_booking_api_url', 'http://localhost:30001/api')
        ));
    }
    
    public function booking_shortcode($atts) {
        $atts = shortcode_atts(array(
            'telescope_id' => '',
            'view' => 'booking' // booking, list, calendar
        ), $atts);
        
        ob_start();
        ?>
        <div id="observatory-booking-app" 
             data-telescope-id="<?php echo esc_attr($atts['telescope_id']); ?>"
             data-view="<?php echo esc_attr($atts['view']); ?>">
            <div class="observatory-loading">
                <p>Loading Observatory Booking System...</p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
    
    public function handle_api_request() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'observatory_booking_nonce')) {
            wp_die('Security check failed');
        }
        
        // Proxy API requests to the Node.js backend
        $api_url = get_option('observatory_booking_api_url', 'http://localhost:30001/api');
        $endpoint = sanitize_text_field($_POST['endpoint']);
        $method = sanitize_text_field($_POST['method']);
        $data = isset($_POST['data']) ? $_POST['data'] : array();
        
        $response = wp_remote_request($api_url . $endpoint, array(
            'method' => $method,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . sanitize_text_field($_POST['token'])
            ),
            'body' => json_encode($data),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error('API request failed');
        } else {
            wp_send_json_success(json_decode(wp_remote_retrieve_body($response), true));
        }
    }
    
    public function admin_menu() {
        add_options_page(
            'Observatory Booking Settings',
            'Observatory Booking',
            'manage_options',
            'observatory-booking',
            array($this, 'admin_page')
        );
    }
    
    public function admin_page() {
        if (isset($_POST['submit'])) {
            update_option('observatory_booking_api_url', sanitize_url($_POST['api_url']));
            echo '<div class="notice notice-success"><p>Settings saved!</p></div>';
        }
        
        $api_url = get_option('observatory_booking_api_url', 'http://localhost:30001/api');
        ?>
        <div class="wrap">
            <h1>Observatory Booking Settings</h1>
            <form method="post" action="">
                <table class="form-table">
                    <tr>
                        <th scope="row">API URL</th>
                        <td>
                            <input type="url" name="api_url" value="<?php echo esc_attr($api_url); ?>" class="regular-text" />
                            <p class="description">URL of your Observatory Booking API server</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
            
            <h2>Usage</h2>
            <p>Use these shortcodes to display the booking system:</p>
            <ul>
                <li><code>[observatory_booking]</code> - Display the booking form</li>
                <li><code>[observatory_booking view="list"]</code> - Display user's bookings</li>
                <li><code>[observatory_booking telescope_id="TELESCOPE_ID"]</code> - Pre-select a telescope</li>
            </ul>
        </div>
        <?php
    }
    
    private function create_tables() {
        global $wpdb;
        
        $charset_collate = $wpdb->get_charset_collate();
        
        // We'll use the API for data storage, but could add local caching tables here if needed
        $sql = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}observatory_bookings_cache (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            booking_id varchar(255) NOT NULL,
            user_id bigint(20) NOT NULL,
            data longtext NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY booking_id (booking_id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
}

// Initialize the plugin
new ObservatoryBookingPlugin();

// Activation hook
register_activation_hook(__FILE__, function() {
    // Create tables and set default options
    update_option('observatory_booking_api_url', 'http://localhost:30001/api');
});

// Deactivation hook
register_deactivation_hook(__FILE__, function() {
    // Cleanup if needed
});
?>
