/**
 * Observatory Booking WordPress Plugin Frontend
 * This script embeds the React app into WordPress pages via shortcode
 */

(function($) {
    'use strict';

    // Observatory Booking App Class
    class ObservatoryBookingApp {
        constructor(container) {
            this.container = container;
            this.apiUrl = observatoryBooking.apiUrl;
            this.ajaxUrl = observatoryBooking.ajaxUrl;
            this.nonce = observatoryBooking.nonce;
            this.token = localStorage.getItem('observatory_token');
            
            this.init();
        }

        init() {
            this.createAppContainer();
            this.loadReactApp();
        }

        createAppContainer() {
            const telescopeId = this.container.data('telescope-id');
            const view = this.container.data('view') || 'booking';

            // Create container for React app
            this.container.html(`
                <div id="observatory-react-root" 
                     data-telescope-id="${telescopeId}"
                     data-view="${view}">
                    <div class="observatory-loading">
                        <div class="loading-spinner"></div>
                        <p>Loading Observatory Booking System...</p>
                    </div>
                </div>
            `);
        }

        loadReactApp() {
            // Load React app bundle
            this.loadScript('https://unpkg.com/react@18/umd/react.production.min.js')
                .then(() => this.loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'))
                .then(() => this.loadScript('https://unpkg.com/@mui/material@latest/umd/material-ui.production.min.js'))
                .then(() => {
                    // Initialize the embedded app
                    this.initEmbeddedApp();
                })
                .catch(error => {
                    console.error('Failed to load React app:', error);
                    this.showError('Failed to load booking system');
                });
        }

        loadScript(src) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        initEmbeddedApp() {
            // Create a simplified version of the booking app for WordPress
            const container = document.getElementById('observatory-react-root');
            const telescopeId = container.dataset.telescopeId;
            const view = container.dataset.view;

            // Simple booking form implementation
            this.renderBookingForm(container, telescopeId, view);
        }

        renderBookingForm(container, telescopeId, view) {
            const html = `
                <div class="observatory-booking-form">
                    <h3>Observatory Telescope Booking</h3>
                    
                    <div id="booking-form" style="display: ${view === 'booking' ? 'block' : 'none'}">
                        <form id="telescope-booking-form">
                            <div class="form-group">
                                <label for="telescope-select">Select Telescope:</label>
                                <select id="telescope-select" required>
                                    <option value="">Loading telescopes...</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="booking-date">Date:</label>
                                <input type="date" id="booking-date" required min="${new Date().toISOString().split('T')[0]}">
                            </div>
                            
                            <div class="form-group">
                                <label for="time-slot">Available Times:</label>
                                <div id="time-slots" class="time-slots">
                                    <p>Select a date to see available times</p>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="purpose">Purpose of Observation:</label>
                                <textarea id="purpose" rows="3" placeholder="Describe what you plan to observe..." required></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="notes">Additional Notes (Optional):</label>
                                <textarea id="notes" rows="2" placeholder="Any special requirements or notes..."></textarea>
                            </div>
                            
                            <button type="submit" class="btn btn-primary">Book Observatory Time</button>
                        </form>
                    </div>
                    
                    <div id="user-bookings" style="display: ${view === 'list' ? 'block' : 'none'}">
                        <h4>My Bookings</h4>
                        <div id="bookings-list">
                            <p>Loading your bookings...</p>
                        </div>
                    </div>
                    
                    <div id="auth-section" style="display: none;">
                        <h4>Sign In Required</h4>
                        <p>Please sign in to book observatory time.</p>
                        <form id="login-form">
                            <div class="form-group">
                                <input type="email" placeholder="Email" required>
                            </div>
                            <div class="form-group">
                                <input type="password" placeholder="Password" required>
                            </div>
                            <button type="submit" class="btn btn-primary">Sign In</button>
                        </form>
                    </div>
                </div>
            `;

            container.innerHTML = html;
            this.setupEventListeners();
            this.loadTelescopes(telescopeId);

            // Load user bookings if in list view
            if (view === 'list') {
                this.loadUserBookings();
            }
        }

        setupEventListeners() {
            const form = document.getElementById('telescope-booking-form');
            const dateInput = document.getElementById('booking-date');
            const telescopeSelect = document.getElementById('telescope-select');

            if (form) {
                form.addEventListener('submit', (e) => this.handleBookingSubmit(e));
            }

            if (dateInput && telescopeSelect) {
                dateInput.addEventListener('change', () => this.loadTimeSlots());
                telescopeSelect.addEventListener('change', () => this.loadTimeSlots());
            }
        }

        async loadTelescopes(preselectedId = '') {
            try {
                const response = await this.apiRequest('/telescopes', 'GET');
                const telescopes = response.data || [];
                
                const select = document.getElementById('telescope-select');
                select.innerHTML = '<option value="">Select a telescope</option>';
                
                telescopes.forEach(telescope => {
                    const option = document.createElement('option');
                    option.value = telescope._id;
                    option.textContent = `${telescope.name} - ${telescope.location}`;
                    if (telescope._id === preselectedId) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });

                if (preselectedId) {
                    this.loadTimeSlots();
                }
            } catch (error) {
                console.error('Failed to load telescopes:', error);
            }
        }

        async loadTimeSlots() {
            const telescopeId = document.getElementById('telescope-select').value;
            const date = document.getElementById('booking-date').value;
            const slotsContainer = document.getElementById('time-slots');

            if (!telescopeId || !date) {
                slotsContainer.innerHTML = '<p>Select telescope and date to see available times</p>';
                return;
            }

            slotsContainer.innerHTML = '<p>Loading available times...</p>';

            try {
                const response = await this.apiRequest(`/bookings/available/${telescopeId}?date=${date}`, 'GET');
                const slots = response.data || [];

                if (slots.length === 0) {
                    slotsContainer.innerHTML = '<p>No available times for this date</p>';
                    return;
                }

                const slotsHtml = slots.map(slot => `
                    <label class="time-slot">
                        <input type="radio" name="time-slot" value="${slot.startTime}|${slot.endTime}" required>
                        <span>${slot.display}</span>
                    </label>
                `).join('');

                slotsContainer.innerHTML = slotsHtml;
            } catch (error) {
                console.error('Failed to load time slots:', error);
                slotsContainer.innerHTML = '<p>Error loading available times</p>';
            }
        }

        async handleBookingSubmit(e) {
            e.preventDefault();

            if (!this.token) {
                this.showAuthForm();
                return;
            }

            const formData = new FormData(e.target);
            const timeSlot = document.querySelector('input[name="time-slot"]:checked');
            
            if (!timeSlot) {
                alert('Please select a time slot');
                return;
            }

            const [startTime, endTime] = timeSlot.value.split('|');
            
            const bookingData = {
                telescope: document.getElementById('telescope-select').value,
                startTime,
                endTime,
                purpose: document.getElementById('purpose').value,
                notes: document.getElementById('notes').value
            };

            try {
                const response = await this.apiRequest('/bookings', 'POST', bookingData);
                alert('Booking created successfully!');
                e.target.reset();
                document.getElementById('time-slots').innerHTML = '<p>Select a date to see available times</p>';
            } catch (error) {
                alert('Failed to create booking: ' + (error.message || 'Unknown error'));
            }
        }

        async apiRequest(endpoint, method = 'GET', data = null) {
            const url = this.apiUrl + endpoint;
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            if (this.token) {
                options.headers.Authorization = `Bearer ${this.token}`;
            }

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'API request failed');
            }

            return result;
        }

        showAuthForm() {
            document.getElementById('booking-form').style.display = 'none';
            document.getElementById('auth-section').style.display = 'block';
        }

        showError(message) {
            this.container.html(`
                <div class="observatory-error">
                    <p>Error: ${message}</p>
                    <button onclick="location.reload()">Retry</button>
                </div>
            `);
        }
    }

    // Initialize when DOM is ready
    $(document).ready(function() {
        $('.observatory-booking-app, #observatory-booking-app').each(function() {
            new ObservatoryBookingApp($(this));
        });
    });

})(jQuery);
