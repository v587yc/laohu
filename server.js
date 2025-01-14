const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// 启用 CORS，允许所有来源
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS']
}));

// 处理预检请求
app.options('*', cors());

// 处理所有到 /api 的请求
app.get('/api', async (req, res) => {
    try {
        // 构建完整的 URL
        const targetUrl = 'https://api.tiger-sms.com/stubs/handler_api.php';
        
        // 获取所有查询参数
        const params = new URLSearchParams(req.query).toString();
        const fullUrl = `${targetUrl}?${params}`;
        
        console.log('Requesting:', fullUrl); // 调试日志
        
        // 发送请求到目标 API
        const response = await axios({
            method: 'get',
            url: fullUrl,
            timeout: 10000, // 10秒超时
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // 返回数据
        res.send(response.data);
    } catch (error) {
        console.error('Error details:', error);
        if (error.response) {
            // 目标服务器返回的错误
            res.status(error.response.status).send(error.response.data);
        } else if (error.request) {
            // 请求发送失败
            res.status(500).send('无法连接到目标服务器');
        } else {
            // 其他错误
            res.status(500).send(error.message);
        }
    }
});

// 添加健康检查端点
app.get('/health', (req, res) => {
    res.send('OK');
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 