const axios = require('axios');

module.exports = async (req, res) => {
    // 设置更完整的 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);

    // 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // 获取所有查询参数
        const params = req.query;
        
        // 发送请求到目标 API
        const response = await axios.get('https://api.tiger-sms.com/stubs/handler_api.php', {
            params: params
        });
        
        // 返回数据
        res.status(200).send(response.data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(error.message);
    }
}; 