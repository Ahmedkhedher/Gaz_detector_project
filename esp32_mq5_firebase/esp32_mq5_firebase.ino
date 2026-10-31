#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info.
#include "addons/RTDBHelper.h"

// 1. Define WiFi credentials
#define WIFI_SSID "Ahmed"
#define WIFI_PASSWORD "1234abcd"

// 2. Define Firebase Project API Key
#define API_KEY "AIzaSyAseHslRnydfHQjIDfLERa5BF0bzRm7z8c"

// 3. Define Firebase Realtime Database URL
#define DATABASE_URL "https://gasmonitor-5ec63-default-rtdb.firebaseio.com"

// 3.1. Define Database Secret (Legacy)
#define DATABASE_SECRET "Yd64fPoNqzyEXd5puAHX8FcXd1d0Kfmq20b7ZlNi"

// 4. Define MQ-5 Sensor Pin
#define MQ5_PIN 34 // Analog pin for ESP32

// Define Firebase Data object
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long sendDataPrevMillis = 0;
int count = 0;
bool signupOK = false;

void setup() {
  Serial.begin(115200);

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());
  Serial.println();

  // Assign the API key (required)
  config.api_key = API_KEY;

  // Assign the RTDB URL (required)
  config.database_url = DATABASE_URL;

  // Assign the database secret (legacy)
  config.signer.tokens.legacy_token = DATABASE_SECRET;

  // Assign the callback function for the long running token generation task
  config.token_status_callback = tokenStatusCallback; // see addons/TokenHelper.h

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  // Read MQ-5 Sensor
  int sensorValue = analogRead(MQ5_PIN);
  float voltage = sensorValue * (5 / 4095.0);
  
  // Basic gas concentration estimation (can be calibrated for PPM)
  // For now, we'll send the raw value and a percentage
  float gasPercentage = (sensorValue / 4095.0) * 100.0;

  if (Firebase.ready() && (millis() - sendDataPrevMillis > 5000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    // Create a JSON object to send multiple values
    FirebaseJson json;
    json.set("value", sensorValue);
    json.set("percentage", gasPercentage);
    json.set("timestamp", Firebase.getCurrentTime());

    Serial.printf("Sending Gas Data: %d (%.2f%%)... ", sensorValue, gasPercentage);
    
    if (Firebase.RTDB.setJSON(&fbdo, "/gas_sensor/current", &json)) {
      Serial.println("PASSED");
    } else {
      Serial.println("FAILED");
      Serial.println("REASON: " + fbdo.errorReason());
    }

    // Also push to history for the chart
    if (Firebase.RTDB.pushJSON(&fbdo, "/gas_sensor/history", &json)) {
       Serial.println("History pushed");
    }
  }
}
