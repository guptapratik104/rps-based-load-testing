// app.js

// ----------------------
// Configuration
// ----------------------
// Set the target RPS, test duration (in milliseconds) and endpoint URL.
const targetRPS    = 20;               // e.g., target 20 requests per second
const testDuration = 30000;            // e.g., run test for 30 seconds
const testURL      = "https://example.com"; // replace with your endpoint

let currentVUs = 1;                    // start with 1 Virtual User
const maxVUs   = 10;                  // maximum allowed VUs
const intervalTime = 1000;             // adjust every 1 second

// ----------------------
// Global counters and time
// ----------------------
let successCount = 0;
let errorCount   = 0;
let requestCountLastInterval = 0;
let actualRPS = 0;
let startTime = Date.now();

// Array to store our active Virtual Users
const vUsers = [];

// ----------------------
// Simulated HTTP Request
// ----------------------
function httpLibraryRequest(url) {
    return new Promise((resolve, reject) => {
        // Simulate a delay between 50 and 100 ms
        const delay = Math.floor(Math.random() * 50) + 50;
        setTimeout(() => {
            // Simulate a 90% chance of success
            if (Math.random() < 0.9) {
                resolve("OK");
            } else {
                reject(new Error("Request failed"));
            }
        }, delay);
    });
}

// ----------------------
// Virtual User (VU) Definition
// ----------------------
function createVirtualUser() {
    let vu = {
        running: true,
        async run() {
            // Run as long as this VU is active and test duration is not exceeded
            while (this.running && (Date.now() - startTime < testDuration)) {
                try {
                    await httpLibraryRequest(testURL);
                    successCount++;
                } catch (error) {
                    errorCount++;
                }
            }
        },
        stop() {
            this.running = false;
        }
    };
    return vu;
}

// ----------------------
// Spawn and reduce VU functions
// ----------------------
function spawnRequests(vuCount) {
    for (let i = 0; i < vuCount; i++) {
        const vu = createVirtualUser();
        vUsers.push(vu);
        vu.run();
    }
}

function reduceActiveConcurrency(vusToRemove) {
    // Remove the requested number of VUs (stop them gracefully)
    for (let i = 0; i < vusToRemove; i++) {
        if (vUsers.length > 0) {
            const vu = vUsers.pop();
            vu.stop();
        }
    }
}

// For demo purposes, always add or remove one VU at a time.
function calculateIncrement() {
    return 1;
}

function calculateDecrement() {
    return 1;
}

// ----------------------
// Measure and adjust function
// ----------------------
function measureAndAdjust() {
    const totalRequests = successCount + errorCount;
    const requestsInLastInterval = totalRequests - requestCountLastInterval;
    requestCountLastInterval = totalRequests;
    actualRPS = requestsInLastInterval; // since intervalTime is 1 second

    // Adjust VUs based on measured RPS vs target
    if (actualRPS < targetRPS && currentVUs < maxVUs) {
        const vusToAdd = calculateIncrement();
        spawnRequests(vusToAdd);
        currentVUs += vusToAdd;
    } else if (actualRPS > targetRPS && currentVUs > 1) {
        const vusToRemove = calculateDecrement();
        reduceActiveConcurrency(vusToRemove);
        currentVUs = Math.max(currentVUs - vusToRemove, 1);
    }

    console.log(
        "Time:", ((Date.now() - startTime)/1000).toFixed(1) + "s",
        " RPS:", actualRPS,
        " VUs:", currentVUs,
        " Success:", successCount,
        " Errors:", errorCount
    );
}

// ----------------------
// Main Test Flow
// ----------------------
function main() {
    // Spawn initial VU(s)
    spawnRequests(currentVUs);

    // Set interval for measuring and adjusting VUs every second
    const metricsInterval = setInterval(() => {
        measureAndAdjust();
    }, intervalTime);

    // End the test after the test duration and stop all VUs
    setTimeout(() => {
        clearInterval(metricsInterval);
        // Stop all VUs gracefully
        for (const vu of vUsers) {
            vu.stop();
        }
        console.log("Test finished.");
        console.log("Final stats:", {
            duration: ((Date.now() - startTime)/1000).toFixed(1) + "s",
            totalSuccess: successCount,
            totalErrors: errorCount,
            finalVUs: currentVUs
        });
        // Exit the process
        process.exit(0);
    }, testDuration);
}

// Start the load test
main();