const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// 启用 CORS
app.use(cors());

// 处理所有到 /api 的请求
app.get('/api', async (req, res) => {
    try {
        // 获取所有查询参数
        const params = req.query;
        
        // 发送请求到目标 API
        const response = await axios.get('https://api.tiger-sms.com/stubs/handler_api.php', {
            params: params
        });
        
        // 返回数据
        res.send(response.data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(error.message);
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 