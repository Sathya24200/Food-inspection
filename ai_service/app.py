
import cv2
import numpy as np
from ultralytics import YOLO
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import os
from PIL import Image

app = Flask(__name__)
CORS(app)

# Load YOLOv8 model
# Try to load fine-tuned model first, fallback to base model
MODEL_PATH = 'models/best.pt'
if os.path.exists(MODEL_PATH):
    print(f"Loading custom model from {MODEL_PATH}")
    yolo_model = YOLO(MODEL_PATH)
else:
    print("Custom model not found, using base yolov8n.pt (Demo mode)")
    yolo_model = YOLO('yolov8n.pt') 

def base64_to_image(base64_string):
    if "," in base64_string:
        base64_string = base64_string.split(",")[1]
    imgdata = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(imgdata))
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    image_b64 = data.get('image')
    
    if not image_b64:
        return jsonify({'error': 'No image provided'}), 400
    
    img = base64_to_image(image_b64)
    
    # Run YOLO detection
    results = yolo_model(img)
    
    is_sealed = False
    confidence = 0.0
    found_package = False
    label = "NO_OBJECT" 
    
    for r in results:
        # Custom model classes: 0: sealed, 1: unsealed
        if len(r.boxes) > 0:
            # Get the detection with highest confidence
            top_box = sorted(r.boxes, key=lambda x: float(x.conf[0]), reverse=True)[0]
            conf = float(top_box.conf[0])
            cls = int(top_box.cls[0])
            class_name = yolo_model.names[cls]
            
            print(f"DEBUG: Detected {class_name} with {conf:.2f} confidence")

            # STEP 1: STRICT OBJECT FILTERING
            # If base YOLO is loaded, skip 'person' (ID 0) to avoid face detection
            if len(yolo_model.names) > 2 and cls == 0:
                print("DEBUG: Skipping person detection...")
                continue

            # STEP 2: CONFIDENCE & PACKAGE CHECK
            # We require > 0.6 confidence to reduce false positives
            if conf > 0.6:
                if len(yolo_model.names) <= 2:
                    # Custom model logic
                    found_package = True
                    confidence = conf
                    is_sealed = (cls == 0)
                    label = "SEALED" if is_sealed else "UNSEALED"
                else:
                    # Demo mode: Only accept specific food/package proxies
                    # 39:bottle, 41:cup, 45:bowl, 47:apple, 48:sandwich...
                    if cls in [39, 41, 45, 47, 48, 49, 50, 51]: 
                        found_package = True
                        confidence = conf
                        # In demo mode, we use confidence to 'guess' status
                        is_sealed = conf > 0.75 
                        label = "SEALED" if is_sealed else "UNSEALED"

    if not found_package:
        label = "NO_OBJECT"
        is_sealed = False
        confidence = 0.0

    # Final response
    return jsonify({
        'status': label,
        'isSealed': bool(is_sealed),
        'confidence': f"{confidence*100:.1f}%",
        'packageDetected': found_package
    })

if __name__ == '__main__':
    app.run(port=5001, debug=True)
