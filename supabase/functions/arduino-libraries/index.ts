import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArduinoLibrary {
  name: string;
  version: string;
  author: string;
  description: string;
  includes: string[];
  dependencies: string[];
  categories: string[];
  examples: string[];
  installed: boolean;
}

// Real Arduino library database
const ARDUINO_LIBRARIES: ArduinoLibrary[] = [
  {
    name: "Servo",
    version: "1.2.1",
    author: "Michael Margolis, Arduino",
    description: "Allows Arduino boards to control a variety of servo motors.",
    includes: ["Servo.h"],
    dependencies: [],
    categories: ["Device Control"],
    examples: ["Knob", "Sweep", "ServoRead"],
    installed: true
  },
  {
    name: "LiquidCrystal",
    version: "1.0.7",
    author: "Arduino, Adafruit",
    description: "Allows communication with alphanumeric liquid crystal displays (LCDs).",
    includes: ["LiquidCrystal.h"],
    dependencies: [],
    categories: ["Display"],
    examples: ["HelloWorld", "Blink", "Cursor"],
    installed: true
  },
  {
    name: "SoftwareSerial",
    version: "1.0",
    author: "Arduino",
    description: "Multi-instance software serial library for Arduino",
    includes: ["SoftwareSerial.h"],
    dependencies: [],
    categories: ["Communication"],
    examples: ["SoftwareSerialExample", "TwoPortReceive"],
    installed: true
  },
  {
    name: "Wire",
    version: "1.0",
    author: "Arduino",
    description: "This library allows you to communicate with I2C / TWI devices.",
    includes: ["Wire.h"],
    dependencies: [],
    categories: ["Communication"],
    examples: ["master_reader", "master_writer", "slave_receiver"],
    installed: true
  },
  {
    name: "SPI", 
    version: "1.0",
    author: "Arduino",
    description: "Enables the communication with devices that use the Serial Peripheral Interface (SPI) Bus.",
    includes: ["SPI.h"],
    dependencies: [],
    categories: ["Communication"],
    examples: ["BarometricPressureSensor", "DigitalPotControl"],
    installed: true
  },
  {
    name: "WiFi",
    version: "1.2.7",
    author: "Arduino",
    description: "Enables network connection (local and Internet) using the Arduino WiFi Shield.",
    includes: ["WiFi.h"],
    dependencies: [],
    categories: ["Communication"],
    examples: ["ConnectWithWPA", "WiFiWebClient", "WiFiWebServer"],
    installed: false
  },
  {
    name: "Ethernet",
    version: "2.0.2",
    author: "Arduino",
    description: "Enables network connection (local and Internet) using the Arduino Ethernet Shield or Shield 2.",
    includes: ["Ethernet.h"],
    dependencies: ["SPI"],
    categories: ["Communication"],
    examples: ["ChatServer", "WebClient", "WebServer"],
    installed: false
  },
  {
    name: "SD",
    version: "1.2.4",
    author: "Arduino, SparkFun",
    description: "Enables reading and writing on SD cards.",
    includes: ["SD.h"],
    dependencies: ["SPI"],
    categories: ["Data Storage"],
    examples: ["CardInfo", "Datalogger", "Files"],
    installed: false
  },
  {
    name: "Stepper",
    version: "1.1.3",
    author: "Arduino",
    description: "Allows Arduino boards to control a variety of stepper motors.",
    includes: ["Stepper.h"],
    dependencies: [],
    categories: ["Device Control"],
    examples: ["MotorKnob", "stepper_oneRevolution", "stepper_speedControl"],
    installed: false
  },
  {
    name: "EEPROM",
    version: "2.0",
    author: "Arduino, Christopher Andrews",
    description: "Enables reading and writing to the permanent storage.",
    includes: ["EEPROM.h"],
    dependencies: [],
    categories: ["Data Storage"],
    examples: ["eeprom_clear", "eeprom_read", "eeprom_write"],
    installed: true
  },
  {
    name: "ESP32Servo",
    version: "0.13.0",
    author: "Kevin Harrington, John K. Bennett",
    description: "ESP32 compatible servo library",
    includes: ["ESP32Servo.h"],
    dependencies: [],
    categories: ["Device Control"],
    examples: ["ESP32_Servo_Example", "MultipleServo"],
    installed: false
  },
  {
    name: "DHT sensor library",
    version: "1.4.4",
    author: "Adafruit",
    description: "Arduino library for DHT11, DHT22, etc Temperature & Humidity Sensors",
    includes: ["DHT.h"],
    dependencies: ["Adafruit Unified Sensor"],
    categories: ["Sensors"],
    examples: ["DHTtester", "DHT_ESP32"],
    installed: false
  },
  {
    name: "Adafruit Unified Sensor",
    version: "1.1.6",
    author: "Adafruit",
    description: "Required for all Adafruit Unified Sensor based libraries.",
    includes: ["Adafruit_Sensor.h"],
    dependencies: [],
    categories: ["Sensors"],
    examples: [],
    installed: false
  }
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();

  try {
    switch (action) {
      case 'list':
        return handleListLibraries(req);
      case 'search':
        return handleSearchLibraries(req);
      case 'install':
        return handleInstallLibrary(req);
      case 'uninstall':
        return handleUninstallLibrary(req);
      case 'info':
        return handleLibraryInfo(req);
      case 'examples':
        return handleGetExamples(req);
      default:
        return handleListLibraries(req);
    }
  } catch (error) {
    console.error('Arduino libraries error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleListLibraries(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const installed = url.searchParams.get('installed');

  let libraries = [...ARDUINO_LIBRARIES];

  // Filter by category
  if (category && category !== 'all') {
    libraries = libraries.filter(lib => 
      lib.categories.some(cat => cat.toLowerCase().includes(category.toLowerCase()))
    );
  }

  // Filter by installation status
  if (installed === 'true') {
    libraries = libraries.filter(lib => lib.installed);
  } else if (installed === 'false') {
    libraries = libraries.filter(lib => !lib.installed);
  }

  return new Response(JSON.stringify({
    success: true,
    libraries: libraries,
    total: libraries.length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleSearchLibraries(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get('q')?.toLowerCase() || '';

  if (!query) {
    return handleListLibraries(req);
  }

  const libraries = ARDUINO_LIBRARIES.filter(lib => 
    lib.name.toLowerCase().includes(query) ||
    lib.description.toLowerCase().includes(query) ||
    lib.author.toLowerCase().includes(query) ||
    lib.categories.some(cat => cat.toLowerCase().includes(query))
  );

  return new Response(JSON.stringify({
    success: true,
    libraries: libraries,
    total: libraries.length,
    query: query
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleInstallLibrary(req: Request) {
  const { name, version } = await req.json();
  
  const library = ARDUINO_LIBRARIES.find(lib => lib.name === name);
  if (!library) {
    return new Response(JSON.stringify({
      success: false,
      error: `Library '${name}' not found`
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (library.installed) {
    return new Response(JSON.stringify({
      success: false,
      error: `Library '${name}' is already installed`
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Simulate installation process
  console.log(`Installing library: ${name} v${version || library.version}`);
  
  // Check dependencies
  const missingDeps = [];
  for (const dep of library.dependencies) {
    const depLib = ARDUINO_LIBRARIES.find(lib => lib.name === dep);
    if (!depLib || !depLib.installed) {
      missingDeps.push(dep);
    }
  }

  if (missingDeps.length > 0) {
    return new Response(JSON.stringify({
      success: false,
      error: `Missing dependencies: ${missingDeps.join(', ')}`,
      missingDependencies: missingDeps
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Simulate installation delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  // Mark as installed
  library.installed = true;

  return new Response(JSON.stringify({
    success: true,
    message: `Library '${name}' installed successfully`,
    library: library
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUninstallLibrary(req: Request) {
  const { name } = await req.json();
  
  const library = ARDUINO_LIBRARIES.find(lib => lib.name === name);
  if (!library) {
    return new Response(JSON.stringify({
      success: false,
      error: `Library '${name}' not found`
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!library.installed) {
    return new Response(JSON.stringify({
      success: false,
      error: `Library '${name}' is not installed`
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if other libraries depend on this one
  const dependentLibraries = ARDUINO_LIBRARIES.filter(lib => 
    lib.installed && lib.dependencies.includes(name)
  );

  if (dependentLibraries.length > 0) {
    return new Response(JSON.stringify({
      success: false,
      error: `Cannot uninstall '${name}' - required by: ${dependentLibraries.map(lib => lib.name).join(', ')}`,
      dependentLibraries: dependentLibraries.map(lib => lib.name)
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Simulate uninstallation delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mark as not installed
  library.installed = false;

  return new Response(JSON.stringify({
    success: true,
    message: `Library '${name}' uninstalled successfully`,
    library: library
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleLibraryInfo(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name');

  if (!name) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Library name is required'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const library = ARDUINO_LIBRARIES.find(lib => lib.name === name);
  if (!library) {
    return new Response(JSON.stringify({
      success: false,
      error: `Library '${name}' not found`
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    library: library
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetExamples(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name');

  if (!name) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Library name is required'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const library = ARDUINO_LIBRARIES.find(lib => lib.name === name);
  if (!library) {
    return new Response(JSON.stringify({
      success: false,
      error: `Library '${name}' not found`
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Generate example code for each example
  const examples = library.examples.map(exampleName => ({
    name: exampleName,
    code: generateExampleCode(library.name, exampleName)
  }));

  return new Response(JSON.stringify({
    success: true,
    library: library.name,
    examples: examples
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateExampleCode(libraryName: string, exampleName: string): string {
  // Generate realistic example code based on library and example name
  const examples: { [key: string]: { [key: string]: string } } = {
    "Servo": {
      "Sweep": `#include <Servo.h>

Servo myservo;  // create servo object to control a servo
int pos = 0;    // variable to store the servo position

void setup() {
  myservo.attach(9);  // attaches the servo on pin 9 to the servo object
}

void loop() {
  for (pos = 0; pos <= 180; pos += 1) { // goes from 0 degrees to 180 degrees
    myservo.write(pos);              // tell servo to go to position in variable 'pos'
    delay(15);                       // waits 15ms for the servo to reach the position
  }
  for (pos = 180; pos >= 0; pos -= 1) { // goes from 180 degrees to 0 degrees
    myservo.write(pos);              // tell servo to go to position in variable 'pos'
    delay(15);                       // waits 15ms for the servo to reach the position
  }
}`,
      "Knob": `#include <Servo.h>

Servo myservo;  // create servo object to control a servo

int potpin = 0;  // analog pin used to connect the potentiometer
int val;    // variable to read the value from the analog pin

void setup() {
  myservo.attach(9);  // attaches the servo on pin 9 to the servo object
}

void loop() {
  val = analogRead(potpin);            // reads the value of the potentiometer (value between 0 and 1023)
  val = map(val, 0, 1023, 0, 180);     // scale it to use it with the servo (value between 0 and 180)
  myservo.write(val);                  // sets the servo position according to the scaled value
  delay(15);                           // waits for the servo to get there
}`
    },
    "LiquidCrystal": {
      "HelloWorld": `#include <LiquidCrystal.h>

// initialize the library with the numbers of the interface pins
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  // set up the LCD's number of columns and rows:
  lcd.begin(16, 2);
  // Print a message to the LCD.
  lcd.print("hello, world!");
}

void loop() {
  // set the cursor to column 0, line 1
  // (note: line 1 is the second row, since counting begins with 0):
  lcd.setCursor(0, 1);
  // print the number of seconds since reset:
  lcd.print(millis() / 1000);
}`,
      "Blink": `#include <LiquidCrystal.h>

// initialize the library with the numbers of the interface pins
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  // set up the LCD's number of columns and rows:
  lcd.begin(16, 2);
  // Print a message to the LCD.
  lcd.print("hello, world!");
}

void loop() {
  // Turn off the display:
  lcd.noDisplay();
  delay(500);
  // Turn on the display:
  lcd.display();
  delay(500);
}`
    }
  };

  return examples[libraryName]?.[exampleName] || `// Example code for ${libraryName} - ${exampleName}
#include <${libraryName}.h>

void setup() {
  // Initialize ${libraryName}
  Serial.begin(9600);
  Serial.println("${exampleName} example starting...");
}

void loop() {
  // Add your ${libraryName} code here
  delay(1000);
}`;
}