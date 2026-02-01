from ultralytics import YOLO
import os

def train_model():
    # Load a pretrained YOLOv8n model
    model = YOLO('yolov8n.pt')

    # Train the model
    # We use data.yaml which points to our dataset
    # epochs: Number of passes over the dataset. Increase for better accuracy (e.g., 50 or 100)
    # imgsz: Image size
    print("Starting training...")
    results = model.train(
        data='data.yaml', 
        epochs=50, 
        imgsz=640, 
        batch=8,
        name='food_seal_model'
    )
    
    print("Training complete!")
    best_model = os.path.join(results.save_dir, 'weights', 'best.pt')
    
    # Save to models directory for app.py
    os.makedirs('models', exist_ok=True)
    import shutil
    shutil.copy(best_model, 'models/best.pt')
    print(f"Best model saved to: models/best.pt")

if __name__ == '__main__':
    train_model()
