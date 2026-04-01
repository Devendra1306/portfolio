from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get('PORT', 3000))
ENV = os.environ.get('NODE_ENV', 'development')

# Path to the dist directory (frontend build)
# server.py is in /server, so dist is in ../dist
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../dist')

@app.route('/api/contact', methods=['POST'])
def contact():
    print(f"Received contact form submission: {request.json}")
    data = request.json
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    # Placeholder for email sending logic since we don't have SMTP creds yet
    # In production, we would use smtplib or a flask-mail extension here.

    # Simulate delay
    time.sleep(1)

    return jsonify({'success': True, 'message': 'Email sent successfully (mock)'})

# Serve static files in production (or if specifically requested)
# This mimics the behavior: if (process.env.NODE_ENV === 'production')
if ENV == 'production' or os.path.exists(DIST_DIR):
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
            return send_from_directory(DIST_DIR, path)
        else:
            # Return index.html for any other route (SPA client-side routing)
            # Only if index.html exists
            if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
                 return send_from_directory(DIST_DIR, 'index.html')
            return "Production build not found. Run 'npm run build' first.", 404

if __name__ == '__main__':
    print(f"Server running on port {PORT}")
    app.run(port=PORT, debug=True)
