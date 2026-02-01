import cv2
import numpy as np
import os
import random

def apply_perspective(image):
    h, w = image.shape[:2]
    # Random perspective transform
    pts1 = np.float32([[0,0], [w,0], [0,h], [w,h]])
    max_shift = 0.1
    pts2 = np.float32([
        [random.uniform(0, w*max_shift), random.uniform(0, h*max_shift)],
        [random.uniform(w*(1-max_shift), w), random.uniform(0, h*max_shift)],
        [random.uniform(0, w*max_shift), random.uniform(h*(1-max_shift), h)],
        [random.uniform(w*(1-max_shift), w), random.uniform(h*(1-max_shift), h)]
    ])
    M = cv2.getPerspectiveTransform(pts1, pts2)
    return cv2.warpPerspective(image, M, (w, h))

def add_noise(image):
    row, col, ch = image.shape
    mean = 0
    var = random.uniform(0.1, 10.0)
    sigma = var**0.5
    gauss = np.random.normal(mean, sigma, (row, col, ch))
    gauss = gauss.reshape(row, col, ch)
    noisy = image + gauss
    return np.clip(noisy, 0, 255).astype(np.uint8)

def shift_hsv(image):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:,:,0] = (hsv[:,:,0] + random.uniform(-10, 10)) % 180
    hsv[:,:,1] = np.clip(hsv[:,:,1] * random.uniform(0.7, 1.3), 0, 255)
    hsv[:,:,2] = np.clip(hsv[:,:,2] * random.uniform(0.7, 1.3), 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

def augment_image(image, label, output_dir, count, start_index):
    h, w = image.shape[:2]
    for i in range(count):
        # Start with original or perspective shift
        aug_img = image.copy()
        
        if random.random() > 0.5:
            aug_img = cv2.flip(aug_img, random.choice([-1, 0, 1]))
            
        if random.random() > 0.3:
            aug_img = apply_perspective(aug_img)
            
        # Random rotation
        angle = random.uniform(-30, 30)
        M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1.0)
        aug_img = cv2.warpAffine(aug_img, M, (w, h), borderMode=cv2.BORDER_REFLECT)
        
        # Color & Noise
        if random.random() > 0.4:
            aug_img = shift_hsv(aug_img)
        if random.random() > 0.5:
            aug_img = add_noise(aug_img)
        if random.random() > 0.7:
            ksize = random.choice([3, 5])
            aug_img = cv2.GaussianBlur(aug_img, (ksize, ksize), 0)
        
        # Save image
        img_name = f"{label}_{start_index + i}.jpg"
        cv2.imwrite(os.path.join(output_dir, "images", "train", img_name), aug_img)
        
        # Save label (YOLO format: class x_center y_center width height)
        with open(os.path.join(output_dir, "labels", "train", f"{label}_{start_index + i}.txt"), "w") as f:
            # FIX: Use 'in' to match variations like 'sealed_src1'
            class_id = 0 if "unsealed" not in label.lower() and "sealed" in label.lower() else 1
            # Since these are zoomed photos of the item, we assume it covers the center
            # In real labeling we'd be precise, but for augmentation of a single item image:
            f.write(f"{class_id} 0.5 0.5 0.8 0.8\n")

def prepare_dataset():
    dataset_path = "dataset"
    os.makedirs(os.path.join(dataset_path, "images", "train"), exist_ok=True)
    os.makedirs(os.path.join(dataset_path, "images", "val"), exist_ok=True)
    os.makedirs(os.path.join(dataset_path, "labels", "train"), exist_ok=True)
    os.makedirs(os.path.join(dataset_path, "labels", "val"), exist_ok=True)

    # Define source images for each class
    sealed_sources = [
        "../sealed.webp",
        "sealed_base_1_1769914906402.png",
        "sealed_base_2_1769914925874.png",
        "sealed_base_3_1769914977872.png"
    ]
    
    unsealed_sources = [
        "../unsealed.webp",
        "unsealed_base_1_1769914942783.png",
        "unsealed_base_2_1769914959551.png",
        "unsealed_base_3_1769914996896.png"
    ]

    # Process Sealed
    print("Generating 100 UNIQUE SEALED images from 4 different base types...")
    for idx, path in enumerate(sealed_sources):
        img = cv2.imread(path)
        if img is not None:
            # Generate 25 augmented images per source to reach 100
            augment_image(img, f"sealed_src{idx}", dataset_path, 25, 0)
            # Add one to val
            cv2.imwrite(os.path.join(dataset_path, "images", "val", f"sealed_val_{idx}.jpg"), img)
            with open(os.path.join(dataset_path, "labels", "val", f"sealed_val_{idx}.txt"), "w") as f:
                f.write("0 0.5 0.5 0.8 0.8\n")
        else:
            print(f"Warning: Could not read {path}")

    # Process Unsealed
    print("Generating 100 UNIQUE UNSEALED images from 4 different base types...")
    for idx, path in enumerate(unsealed_sources):
        img = cv2.imread(path)
        if img is not None:
            # Generate 25 augmented images per source to reach 100
            augment_image(img, f"unsealed_src{idx}", dataset_path, 25, 0)
            # Add one to val
            cv2.imwrite(os.path.join(dataset_path, "images", "val", f"unsealed_val_{idx}.jpg"), img)
            with open(os.path.join(dataset_path, "labels", "val", f"unsealed_val_{idx}.txt"), "w") as f:
                f.write("1 0.5 0.5 0.8 0.8\n")
        else:
            print(f"Warning: Could not read {path}")

    print("✅ Comprehensive dataset with 200+ samples (including 8+ base variations) complete!")

if __name__ == "__main__":
    prepare_dataset()
