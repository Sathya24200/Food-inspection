
/*
  Smart Food Inspection - Arduino Sketch
  Reads Temperature (LM35/DHT11) and Weight (Load Cell with HX711)
  Sends data to the web app via Serial.
*/

#include <DHT.h> // If using DHT sensor
// #include "HX711.h" // If using Load Cell

#define DHTPIN 2
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Load Cell Pins
// const int LOADCELL_DOUT_PIN = 4;
// const int LOADCELL_SCK_PIN = 5;
// HX711 scale;

void setup() {
  Serial.begin(9600);
  dht.begin();
  // scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  // scale.set_scale(2280.f); // Adjust to your calibration factor
  // scale.tare();
}

void loop() {
  // 1. Read Temperature
  float t = dht.readTemperature();
  if (isnan(t)) t = 24.5; // Fallback for demo

  // 2. Read Weight (Mocked if no scale)
  float w = 500.0; 
  // w = scale.get_units(5); 

  // 3. Read physical seal status (Optional switch)
  int sealStatus = 1; // 1 = Sealed, 0 = Unsealed

  // Send data in format compatible with Web App: "T:25.5,W:450,S:1"
  Serial.print("T:");
  Serial.print(t);
  Serial.print(",W:");
  Serial.print(w);
  Serial.print(",S:");
  Serial.println(sealStatus);

  delay(2000); // Send every 2 seconds
}
