import os
import re
import html
import time
import sqlite3
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get('PORT', 3000))
ENV = os.environ.get('NODE_ENV', 'development')

# Path to the dist directory (frontend build) and database
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(SERVER_DIR, '../dist')
DB_PATH = os.path.join(SERVER_DIR, 'contacts.db')

# --- SQLite Database Initialization ---
def init_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()
        logger.info("SQLite database initialized successfully at: %s", DB_PATH)
    except Exception as e:
        logger.error("Failed to initialize SQLite database: %s", e)

# Run database setup
init_db()

# --- In-Memory Rate Limiting ---
# Store format: { ip_address: [timestamp1, timestamp2, ...] }
rate_limit_store = {}
RATE_LIMIT_LIMIT = 3        # Max 3 submissions
RATE_LIMIT_WINDOW = 600     # Window of 10 minutes (600 seconds)

def is_rate_limited(ip):
    now = time.time()
    if ip not in rate_limit_store:
        rate_limit_store[ip] = []
    
    # Filter out timestamps older than the rate limit window
    rate_limit_store[ip] = [t for t in rate_limit_store[ip] if now - t < RATE_LIMIT_WINDOW]
    
    # Check if threshold is breached
    if len(rate_limit_store[ip]) >= RATE_LIMIT_LIMIT:
        return True
    
    # Log the current submission timestamp
    rate_limit_store[ip].append(now)
    return False

# --- Input Validation & Sanitization ---
def sanitize_input(text):
    if not text:
        return ""
    # Strip basic HTML and script tags to prevent XSS/Payload injections
    cleaned = re.sub(r'<[^>]*>', '', text)
    # Escape standard HTML entities
    return html.escape(cleaned).strip()

def validate_email(email):
    # Standard email format regex pattern
    pattern = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return re.match(pattern, email) is not None

# --- SMTP Email Dispatch Function ---
def send_alert_email(name, email, message):
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = os.environ.get('SMTP_PORT')
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    receiver = os.environ.get('CONTACT_RECEIVER')

    # If any required SMTP parameter is missing, skip email sending gracefully
    if not all([smtp_host, smtp_port, smtp_user, smtp_password, receiver]):
        logger.info("SMTP email configurations incomplete. Skipping email delivery (fallback to local SQLite DB logging).")
        return False

    try:
        smtp_port = int(smtp_port)
        use_tls = os.environ.get('SMTP_USE_TLS', 'True').lower() == 'true'

        # Construct email message
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = receiver
        msg['Subject'] = f"✨ Portfolio Contact: Message from {name}"

        # Clean HTML body for email reader
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #0f3460; border-bottom: 2px solid #0f3460; padding-bottom: 8px;">New Contact Submission</h2>
            <p><strong>Name:</strong> {name}</p>
            <p><strong>Email:</strong> <a href="mailto:{email}">{email}</a></p>
            <p><strong>Message:</strong></p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; border-left: 5px solid #d4af37;">
                {message.replace('\n', '<br>')}
            </div>
            <br>
            <p style="font-size: 0.8em; color: #888;">Submitted via Immersive Space Portfolio</p>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, 'html'))

        # Establish SMTP connection
        if use_tls:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            server.starttls()
        else:
            # Assume SSL if not using starttls (port 465)
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)

        server.login(smtp_user, smtp_password)
        server.send_message(msg)
        server.quit()
        logger.info("Contact form notification email sent successfully to %s", receiver)
        return True
    except Exception as e:
        logger.error("Failed to send contact notification email: %s", e)
        return False

# --- API Contact Form Endpoint ---
@app.route('/api/contact', methods=['POST'])
def contact():
    # 1. Rate Limiting Check
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if is_rate_limited(client_ip):
        logger.warning("IP address %s exceeded rate limits", client_ip)
        return jsonify({
            'success': False,
            'message': 'Too many contact submissions. Please try again later.'
        }), 429

    data = request.json or {}
    name_raw = data.get('name', '')
    email_raw = data.get('email', '')
    message_raw = data.get('message', '')

    # 2. Input Sanitization
    name = sanitize_input(name_raw)
    email = sanitize_input(email_raw)
    message = sanitize_input(message_raw)

    # 3. Input Validation Bounds and Formats
    if not name or not email or not message:
        return jsonify({'success': False, 'message': 'All form fields are required.'}), 400

    if len(name) > 100 or len(email) > 100:
        return jsonify({'success': False, 'message': 'Name or Email exceeds length limits.'}), 400

    if len(message) > 2000:
        return jsonify({'success': False, 'message': 'Message is too long (maximum 2000 characters).'}), 400

    if not validate_email(email):
        return jsonify({'success': False, 'message': 'Invalid email address format.'}), 400

    # 4. Save Submission into local SQLite Database
    user_agent = request.headers.get('User-Agent', 'Unknown')
    db_saved = False
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO submissions (name, email, message, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        ''', (name, email, message, client_ip, user_agent))
        conn.commit()
        conn.close()
        db_saved = True
        logger.info("Successfully saved contact message from %s to SQLite DB", name)
    except Exception as e:
        logger.error("Database operation failed: %s", e)

    # 5. Dispatch Email (non-blocking in standard production, but synchronously fine for portfolio traffic)
    email_sent = send_alert_email(name, email, message)

    # 6. Formulate response
    if db_saved:
        response_msg = 'Your message has been saved and sent!' if email_sent else 'Your message has been saved successfully!'
        return jsonify({
            'success': True,
            'message': response_msg
        })
    else:
        # Fallback if DB saving failed but we want to stay operational
        return jsonify({
            'success': False,
            'message': 'Failed to log your message. Please try again later.'
        }), 500

# --- Production Static File Server (SPA client-side routing fallback) ---
if ENV == 'production' or os.path.exists(DIST_DIR):
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
            return send_from_directory(DIST_DIR, path)
        else:
            if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
                 return send_from_directory(DIST_DIR, 'index.html')
            return "Production build not found. Run 'npm run build' first.", 404

if __name__ == '__main__':
    logger.info("Server running on port %d in %s environment", PORT, ENV)
    app.run(port=PORT, debug=(ENV == 'development'))
