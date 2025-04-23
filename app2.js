const targetRPS = 800;
const testDuration = 60000;
const testURL = "https://example.com";
const maxVUs = 100;
const samplingCount = 5;

let currentVUs = 1;
let successCount = 0;
let errorCount = 0;
let lastMeasureTime = 0;
let lastTotalRequests = 0;
let actualRPS = 0;
const startTime = Date.now();
const vUsers = [];

function httpLibraryRequest(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const delayTime = Math.floor(Math.random() * 50) + 50;
        setTimeout(() => {
            const responseTime = Date.now() - startTime;
            if (Math.random() < 0.9) {
                resolve({ status: "OK", responseTime });
            } else {
                reject({ error: "Request failed", responseTime });
            }
        }, delayTime);
    });
}

function createVirtualUser() {
    let running = true;
    async function run() {
        while (running && (Date.now() - startTime < testDuration)) {
            try {
                await httpLibraryRequest(testURL);
                successCount++;
            } catch (error) {
                errorCount++;
            }
        }
    }
    run();
    return {
        stop: () => { running = false; }
    };
}

function spawnRequests(vuCount) {
    for (let i = 0; i < vuCount; i++) {
        const vu = createVirtualUser();
        vUsers.push(vu);
    }
}

function reduceActiveConcurrency(vusToRemove) {
    for (let i = 0; i < vusToRemove; i++) {
        if (vUsers.length > 0) {
            const vu = vUsers.pop();
            vu.stop();
        }
    }
}

async function sampleResponseTimes() {
    console.log("Sampling response times...");
    const responseTimes = [];

    for (let i = 0; i < samplingCount; i++) {
        try {
            const result = await httpLibraryRequest(testURL);
            responseTimes.push(result.responseTime);
        } catch (error) {
            if (error.responseTime) {
                responseTimes.push(error.responseTime);
            }
        }
    }

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    console.log(`Average response time from sampling: ${avgResponseTime.toFixed(1)}ms`);

    const requiredVUs = Math.ceil(targetRPS * avgResponseTime / 1000);
    return Math.min(Math.max(requiredVUs, 1), maxVUs);
}

function measureAndAdjust() {
    const now = Date.now();
    const elapsedSeconds = (now - lastMeasureTime) / 1000;
    const totalRequests = successCount + errorCount;
    const deltaRequests = totalRequests - lastTotalRequests;
    actualRPS = deltaRequests / elapsedSeconds;

    lastTotalRequests = totalRequests;
    lastMeasureTime = now;

    if (actualRPS < targetRPS && currentVUs < maxVUs) {
        const add = 1;
        spawnRequests(add);
        currentVUs += add;
    } else if (actualRPS > targetRPS && currentVUs > 1) {
        const rem = 1;
        reduceActiveConcurrency(rem);
        currentVUs = Math.max(currentVUs - rem, 1);
    }

    console.log(
        `Time: ${((now - startTime)/1000).toFixed(1)}s | ` +
        `RPS: ${actualRPS.toFixed(1)} | ` +
        `VUs: ${currentVUs} | ` +
        `Success: ${successCount} | ` +
        `Errors: ${errorCount}`
    );
}

async function main() {
    const initialVUs = await sampleResponseTimes();
    console.log(`Starting test with ${initialVUs} VUs based on sampling`);

    lastMeasureTime = Date.now();

    currentVUs = initialVUs;
    spawnRequests(currentVUs);

    const adjustInterval = setInterval(() => {
        measureAndAdjust();
    }, 1000);

    setTimeout(() => {
        clearInterval(adjustInterval);
        vUsers.forEach(vu => vu.stop());
        console.log("Test finished.");
        console.log("Final stats:", {
            duration: `${((Date.now() - startTime)/1000).toFixed(1)}s`,
            totalRequests: successCount + errorCount,
            successCount,
            errorCount,
            finalVUs: currentVUs,
            finalRPS: actualRPS.toFixed(1)
        });
        process.exit(0);
    }, testDuration);
}

main().catch(console.error);