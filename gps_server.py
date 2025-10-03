from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/send_location', methods=['GET'])
def send_location():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    if lat and lon:
        return jsonify({"status": "success", "lat": lat, "lon": lon})
    else:
        return jsonify({"status": "error", "message": "Missing lat/lon"}), 400

app.run(host="0.0.0.0", port=5000, debug=True)
