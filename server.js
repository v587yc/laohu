const express = require('express');
const cors = require('cors');
const axios = require('axios');
const tunnel = require('tunnel');
const app = express();

let currentProxyIndex = 0;
let failedProxies = new Set();

// 代理配置
const proxyList = [
    {
        host: '47.243.242.70',
        port: 3128
    },
    {
        host: '47.91.45.198',
        port: 8443
    },
    {
        host: '47.91.45.235',
        port: 8443
    },
    {
        host: '47.88.11.3',
        port: 8443
    },
    {
        host: '47.91.95.174',
        port: 8443
    }
];

// 获取随机代理
function getRandomProxy() {
    // 如果所有代理都失败了，重置失败列表
    if (failedProxies.size >= proxyList.length) {
        failedProxies.clear();
    }

    // 找到一个未失败的代理
    let proxy;
    let attempts = 0;
    do {
        currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
        proxy = proxyList[currentProxyIndex];
        attempts++;
    } while (failedProxies.has(currentProxyIndex) && attempts < proxyList.length);

    return proxy;
}

// 创建代理隧道
function createTunnel(proxy) {
    return tunnel.httpsOverHttp({
        proxy: {
            host: proxy.host,
            port: proxy.port
        }
    });
}

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS']
}));

app.options('*', cors());

app.get('/api', async (req, res) => {
    try {
        const targetUrl = 'https://api.tiger-sms.com/stubs/handler_api.php';
        const params = new URLSearchParams(req.query).toString();
        const fullUrl = `${targetUrl}?${params}`;
        
        console.log('Requesting:', fullUrl);

        // 获取随机代理
        const proxy = getRandomProxy();
        const agent = createTunnel(proxy);
        
        const response = await axios({
            method: 'get',
            url: fullUrl,
            timeout: 30000,
            httpsAgent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            proxy: false // 使用自定义代理而不是系统代理
        });
        
        res.send(response.data);
    } catch (error) {
        // 记录失败的代理
        failedProxies.add(currentProxyIndex);
        
        console.error('Error details:', error);
        
        // 详细的错误日志
        if (error.response) {
            console.error('Response error:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            });
        } else if (error.request) {
            console.error('Request error:', error.request);
        }
        
        // 返回错误信息
        if (error.response) {
            res.status(error.response.status).send(error.response.data);
        } else if (error.request) {
            res.status(500).send('代理连接失败，正在重试...');
        } else {
            res.status(500).send(error.message);
        }
    }
});

// 健康检查
app.get('/health', (req, res) => {
    res.send('OK');
});

// 代理状态检查
app.get('/proxy/status', (req, res) => {
    res.json({
        proxyCount: proxyList.length,
        status: 'active'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 