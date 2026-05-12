#!/usr/bin/env python3
"""
GSM Modem SMS Service
Self-hosted SMS delivery using GSM modem hardware
"""

import os
import logging
import time
from datetime import datetime
from flask import Flask, request, jsonify
from gsmmodem.modem import GsmModem
import serial
import threading
import queue

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/gsm/gsm_modem.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class GsmModemService:
    def __init__(self):
        self.modem = None
        self.modem_device = os.getenv('MODEM_DEVICE', '/dev/ttyUSB0')
        self.modem_baud = int(os.getenv('MODEM_BAUD', '115200'))
        self.modem_pin = os.getenv('MODEM_PIN', '')
        self.sms_center = os.getenv('SMS_CENTER', '')
        self.message_queue = queue.Queue()
        self.is_connected = False

    def connect_modem(self):
        """Connect to GSM modem"""
        try:
            logger.info(f"Connecting to GSM modem at {self.modem_device}")

            # Initialize modem
            self.modem = GsmModem(self.modem_device, self.modem_baud)

            # Connect
            self.modem.connect(self.modem_pin if self.modem_pin else None)

            # Set SMS center if provided
            if self.sms_center:
                self.modem.setSmsc(self.sms_center)

            # Set modem to text mode
            self.modem.smsTextMode = True

            self.is_connected = True
            logger.info("GSM modem connected successfully")

            # Start message processing thread
            threading.Thread(target=self._process_message_queue, daemon=True).start()

            return True

        except Exception as e:
            logger.error(f"Failed to connect to GSM modem: {e}")
            self.is_connected = False
            return False

    def disconnect_modem(self):
        """Disconnect from GSM modem"""
        try:
            if self.modem:
                self.modem.close()
                self.is_connected = False
                logger.info("GSM modem disconnected")
        except Exception as e:
            logger.error(f"Error disconnecting modem: {e}")

    def send_sms(self, to, message):
        """Send SMS message"""
        try:
            if not self.is_connected:
                raise Exception("Modem not connected")

            # Validate phone number (basic validation)
            if not to.startswith('+'):
                to = '+' + to

            # Send SMS
            sms = self.modem.sendSms(to, message)

            logger.info(f"SMS sent to {to}: {message[:50]}...")
            return {
                'success': True,
                'message_id': sms.reference if hasattr(sms, 'reference') else str(time.time()),
                'status': 'sent'
            }

        except Exception as e:
            logger.error(f"Failed to send SMS to {to}: {e}")
            return {
                'success': False,
                'error': str(e),
                'status': 'failed'
            }

    def _process_message_queue(self):
        """Process queued messages"""
        while True:
            try:
                if not self.is_connected:
                    time.sleep(5)  # Wait before retrying
                    continue

                # Get message from queue
                message_data = self.message_queue.get(timeout=1)

                if message_data:
                    result = self.send_sms(message_data['to'], message_data['message'])
                    # Could add callback or webhook here for delivery status

                self.message_queue.task_done()

            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Error processing message queue: {e}")
                time.sleep(1)

    def queue_sms(self, to, message):
        """Queue SMS for sending"""
        self.message_queue.put({
            'to': to,
            'message': message,
            'timestamp': datetime.now().isoformat()
        })
        return {'queued': True}

    def get_modem_info(self):
        """Get modem information"""
        try:
            if not self.is_connected or not self.modem:
                return {'connected': False}

            return {
                'connected': True,
                'imei': self.modem.imei,
                'imsi': self.modem.imsi,
                'network_name': self.modem.networkName,
                'signal_strength': self.modem.signalStrength,
                'smsc': self.modem.smsc,
                'queue_size': self.message_queue.qsize()
            }

        except Exception as e:
            logger.error(f"Error getting modem info: {e}")
            return {'connected': False, 'error': str(e)}

    def health_check(self):
        """Health check"""
        return {
            'status': 'healthy' if self.is_connected else 'unhealthy',
            'modem_connected': self.is_connected,
            'queue_size': self.message_queue.qsize(),
            'timestamp': datetime.now().isoformat()
        }

# Global service instance
gsm_service = GsmModemService()

# Flask app
app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify(gsm_service.health_check())

@app.route('/modem-info', methods=['GET'])
def modem_info():
    """Get modem information"""
    return jsonify(gsm_service.get_modem_info())

@app.route('/send-sms', methods=['POST'])
def send_sms():
    """Send SMS endpoint"""
    try:
        data = request.get_json()

        if not data or 'to' not in data or 'message' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: to, message'
            }), 400

        to = data['to']
        message = data['message']

        # Validate message length (GSM 7-bit limit)
        if len(message.encode('utf-8')) > 160:
            return jsonify({
                'success': False,
                'error': 'Message too long (max 160 characters)'
            }), 400

        # Queue SMS for sending
        result = gsm_service.queue_sms(to, message)

        return jsonify({
            'success': True,
            'message': 'SMS queued for sending',
            'data': result
        })

    except Exception as e:
        logger.error(f"Error in send-sms endpoint: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@app.route('/queue-status', methods=['GET'])
def queue_status():
    """Get queue status"""
    return jsonify({
        'queue_size': gsm_service.message_queue.qsize(),
        'modem_connected': gsm_service.is_connected,
        'timestamp': datetime.now().isoformat()
    })

def main():
    """Main application entry point"""
    logger.info("Starting GSM Modem SMS Service")

    # Connect to modem
    if not gsm_service.connect_modem():
        logger.error("Failed to connect to GSM modem. Exiting.")
        return

    try:
        # Start Flask app
        app.run(host='0.0.0.0', port=8080, debug=False)

    except KeyboardInterrupt:
        logger.info("Shutting down GSM Modem SMS Service")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        gsm_service.disconnect_modem()

if __name__ == '__main__':
    main()