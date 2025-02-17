// 添加配置管理类
class Config {
    static get API_CONFIG() {
        return {
            KEY: 'U7L2XoZEwn5DAExpvuoBFJNzi0iq2fx2',
            BASE_URL: 'https://laohu-nu.vercel.app/sms',
            HISTORY_API: 'https://your-domain.com/history-api.php'
        };
    }
    
    static get FIREBASE_CONFIG() {
        return {
            apiKey: "YVHbqJ7lDQHvpb9VGMMwbGdvoJ5OVwG0ei6q85oat",
            authDomain: "your-app.firebaseapp.com",
            databaseURL: "https://your-app.firebaseio.com",
            projectId: "your-project-id",
            storageBucket: "your-app.appspot.com",
            messagingSenderId: "your-sender-id",
            appId: "your-app-id"
        };
    }
    
    static get STATUS_MAP() {
        return {
            'STATUS_WAIT_CODE': '等待接收验证码中...',
            'STATUS_WAIT_RESEND': '等待重新发送验证码...',
            'STATUS_CANCEL': '已取消',
            'STATUS_OK': '验证码'
        };
    }
    
    static get VALID_USERS() {
        return ['594120', 'jq'];
    }
}

class SMSManager {
    constructor() {
        this.API_KEY = Config.API_CONFIG.KEY;
        this.BASE_URL = Config.API_CONFIG.BASE_URL;
        this.HISTORY_API = Config.API_CONFIG.HISTORY_API;
        this.statusMap = Config.STATUS_MAP;
        this.validUsers = Config.VALID_USERS;
        this.activeNumbers = new Map();
        
        // 添加用户相关属性
        this.currentUser = null;
        this.userHistory = new Map();
        
        // 初始化 Firebase
        firebase.initializeApp(Config.FIREBASE_CONFIG);
        this.database = firebase.database();
        
        this.initLogin();
        this.initTabs();
        
        // 缓存常用DOM元素
        this.elements = {
            numbersList: document.getElementById('numbersList'),
            historyList: document.getElementById('historyList'),
            notification: document.getElementById('notification'),
            notificationText: document.getElementById('notification-text'),
            stats: {
                activeCount: document.getElementById('active-count'),
                successCount: document.getElementById('success-count'),
                historyCount: document.getElementById('history-count'),
                balance: document.getElementById('balance-amount')
            }
        };
        
        // 添加音频对象
        this.notificationSound = document.getElementById('notificationSound');
        this.notificationSound.preload = 'auto';
        this.notificationSound.volume = 1.0; // 确保音量最大
        
        // 配置音频可以在后台播放(iOS)
        this.setupBackgroundAudio();
        
        // 添加页面可见性变化监听
        this.setupVisibilityChange();
    }

    // 添加页面可见性变化监听
    setupVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 页面进入后台时，确保所有轮询继续进行
                this.activeNumbers.forEach((data, id) => {
                    if (data.polling) {
                        this.startPolling(id);
                    }
                });
            }
        });
    }

    initLogin() {
        // 检查是否已登录
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser && this.validUsers.includes(savedUser)) {
            this.login(savedUser);
        } else {
            document.getElementById('loginOverlay').style.display = 'flex';
        }

        // 登录按钮事件
        document.getElementById('loginButton').addEventListener('click', () => {
            const username = document.getElementById('username').value.trim();
            if (this.validUsers.includes(username)) {
                this.login(username);
            } else {
                this.showNotification('用户名无效', 'error');
            }
        });

        // 回车键登录
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('loginButton').click();
            }
        });
    }

    initTabs() {
        const tabs = document.querySelectorAll('.tab-button');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const tabId = tab.getAttribute('data-tab');
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('active');
                });
                document.getElementById(`${tabId}-tab`).classList.add('active');
            });
        });
    }

    login(username) {
        this.currentUser = username;
        localStorage.setItem('currentUser', username);
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('current-username').textContent = username;
        
        // 加载历史记录
        this.loadUserHistory();
        
        // 初始化其他功能
        this.init();
        this.loadSavedNumbers();
        this.updateStats();
        this.updateBalance();
    }

    // 添加在线数据监听
    listenToOnlineData() {
        const userRef = this.database.ref(`users/${this.currentUser}`);
        userRef.on('value', (snapshot) => {
            const data = snapshot.val() || {};
            this.userHistory = new Map(Object.entries(data.history || {}));
            this.updateHistoryDisplay();
            this.updateStats();
        });
    }

    // 修改保存历史记录方法
    async saveHistory(number, code) {
        try {
            const response = await fetch(`${this.HISTORY_API}?action=save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: this.currentUser,
                    phone: number,
                    code: code
                })
            });

            const result = await response.json();
            if (result.success) {
                this.showNotification('记录已保存', 'success');
                this.loadUserHistory(); // 重新加载历史记录
            } else {
                throw new Error('保存失败');
            }
        } catch (error) {
            console.error('保存历史记录失败：', error);
            this.showNotification('保存失败', 'error');
        }
    }

    // 修改加载历史记录方法
    async loadUserHistory() {
        try {
            const response = await fetch(`${this.HISTORY_API}?action=get&username=${this.currentUser}`);
            const records = await response.json();
            
            const historyList = document.getElementById('historyList');
            historyList.innerHTML = '';
            
            records.forEach(record => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <div class="history-number">
                        <i class="fas fa-phone"></i>
                        ${record.phone}
                    </div>
                    <div class="history-code">
                        <i class="fas fa-key"></i>
                        ${record.code}
                    </div>
                    <div class="history-time">
                        <i class="fas fa-clock"></i>
                        ${new Date(record.timestamp * 1000).toLocaleString()}
                    </div>
                `;
                historyList.appendChild(item);
            });
            
            this.updateStats();
        } catch (error) {
            console.error('加载历史记录失败：', error);
            this.showNotification('加载历史记录失败', 'error');
        }
    }

    // 修改更新统计方法
    async updateStats() {
        const { activeCount, successCount, historyCount } = this.elements.stats;
        
        activeCount.textContent = this.activeNumbers.size;
        successCount.textContent = Array.from(this.activeNumbers.values())
            .filter(n => !n.polling).length;
        
        try {
            const response = await fetch(`${this.HISTORY_API}?action=count&username=${this.currentUser}`);
            const data = await response.json();
            historyCount.textContent = data.count;
        } catch (error) {
            console.error('获取历史记录数量失败：', error);
            historyCount.textContent = '0';
        }
    }

    // 重写获取状态方法，添加历史记录功能
    async getStatus(id) {
        try {
            const response = await fetch(`${this.BASE_URL}?api_key=${this.API_KEY}&action=getStatus&id=${id}`);
            const status = await response.text();
            const statusElement = document.getElementById(`status-${id}`);
            const data = this.activeNumbers.get(id);
            
            if (status.startsWith('STATUS_OK:')) {
                const code = status.split(':')[1].trim();
                statusElement.className = 'status success';
                statusElement.innerHTML = `${this.statusMap['STATUS_OK']}: <span class="code">${code}</span>`;
                data.polling = false;
                data.code = code; // 保存验证码
                
                // 播放提示音
                this.playNotificationSound();
                
                // 添加到历史记录
                this.saveHistory(data.number, code);
                
                this.saveNumbers();
            } else {
                const statusKey = Object.keys(this.statusMap).find(key => status.startsWith(key));
                if (statusKey) {
                    statusElement.className = 'status waiting';
                    // 显示原始状态和中文说明
                    statusElement.innerHTML = `
                        ${status}<br>
                        <small>${this.statusMap[statusKey]}</small>
                        <div class="auto-fetch-timer">
                            <i class="fas fa-sync-alt"></i>
                            <span id="poll-timer-${id}">${data.pollTimer}</span>秒后自动获取
                        </div>
                    `;
                } else {
                    statusElement.className = 'status error';
                    statusElement.textContent = status;
                }
            }
        } catch (error) {
            console.error('获取状态错误：', error);
        }
    }

    init() {
        document.getElementById('getNumber').addEventListener('click', () => this.getNewNumber());
        // 每秒更新所有倒计时
        setInterval(() => this.updateAllTimers(), 1000);
    }

    // 保存号码到 localStorage
    saveNumbers() {
        const numbersData = Array.from(this.activeNumbers.entries()).map(([id, data]) => ({
            id,
            number: data.number,
            polling: data.polling,
            startTime: data.startTime
        }));
        localStorage.setItem('smsNumbers', JSON.stringify(numbersData));
    }

    // 从 localStorage 加载号码
    loadSavedNumbers() {
        const savedData = localStorage.getItem('smsNumbers');
        if (savedData) {
            const numbers = JSON.parse(savedData);
            numbers.forEach(data => {
                // 检查是否已过期（20分钟）
                const elapsedMinutes = (Date.now() - data.startTime) / (1000 * 60);
                if (elapsedMinutes < 20) {
                    this.addNumberToList(data.id, data.number, data.startTime);
                    if (data.polling) {
                        this.startPolling(data.id);
                    }
                }
            });
        }
    }

    // 显示通知
    showNotification(message, type = 'info') {
        const { notification, notificationText } = this.elements;
        
        notification.className = 'notification show ' + type;
        notificationText.textContent = message;
        
        setTimeout(() => {
            notification.className = 'notification';
        }, 2000);
    }

    async getNewNumber() {
        try {
            this.showNotification('正在获取新号码...', 'info');
            const response = await fetch(`${this.BASE_URL}?api_key=${this.API_KEY}&action=getNumber&service=hw&country=6`);
            const data = await response.text();
            
            if (data.startsWith('ACCESS_NUMBER:')) {
                const [_, id, number] = data.split(':');
                this.addNumberToList(id, number, Date.now());
                this.startPolling(id);
                // 获取号码成功后更新余额
                this.updateBalance();
            } else {
                alert('获取号码失败：' + data);
            }
            this.updateStats();
        } catch (error) {
            this.showNotification('获取号码失败', 'error');
            console.error('获取号码错误：', error);
        }
    }

    addNumberToList(id, number, startTime = Date.now()) {
        const numbersList = document.getElementById('numbersList');
        const item = document.createElement('div');
        item.className = 'number-item';
        item.id = `number-${id}`;
        
        const displayNumber = number.replace(/^62/, '');
        
        // 修改点击事件处理
        item.onclick = (e) => {
            // 如果点击的是按钮，不执行复制
            if (e.target.closest('.action-button')) {
                return;
            }
            
            // 检查是否已获取到验证码
            const data = this.activeNumbers.get(id);
            if (data && data.code) {
                // 如果有验证码，复制验证码
                this.copyText(data.code);
                this.showNotification('验证码已复制', 'success');
            } else {
                // 如果没有验证码，复制手机号
                this.copyText(displayNumber);
                this.showNotification('手机号已复制', 'success');
            }
        };
        
        item.innerHTML = `
            <div class="number">
                <i class="fas fa-sim-card"></i>
                ${number}
            </div>
            <div class="status waiting" id="status-${id}">
                ${this.statusMap['STATUS_WAIT_CODE']}
                <span class="retry-count" id="retry-count-${id}">(重试次数: 0)</span>
                <span class="poll-timer" id="poll-timer-${id}">5s</span>
            </div>
            <div class="timer">
                <i class="fas fa-clock"></i>
                <span id="timer-${id}">20:00</span>
            </div>
            <div class="actions">
                <button class="action-button primary" onclick="smsManager.resendCode('${id}')">
                    <i class="fas fa-sync-alt"></i>
                    重新获取
                </button>
                <button class="action-button danger" id="cancel-${id}" onclick="smsManager.cancelNumber('${id}')" disabled>
                    <i class="fas fa-times"></i>
                    取消 (<span id="cancel-timer-${id}">120</span>s)
                </button>
            </div>
        `;
        
        numbersList.insertBefore(item, numbersList.firstChild);
        this.activeNumbers.set(id, { 
            number, 
            polling: true, 
            startTime: startTime,
            retryCount: 0,
            pollTimer: 5,
            cancelTimer: 120
        });
        
        // 启动取消按钮倒计时
        this.startCancelTimer(id);
        this.saveNumbers();
        this.updateStats();
    }

    // 添加复制号码的方法
    async copyNumber(number) {
        try {
            await navigator.clipboard.writeText(number);
            this.showNotification('号码已复制到剪贴板', 'success');
        } catch (err) {
            this.showNotification('复制失败', 'error');
        }
    }

    // 添加取消按钮倒计时方法
    startCancelTimer(id) {
        const timer = setInterval(() => {
            const data = this.activeNumbers.get(id);
            if (!data) {
                clearInterval(timer);
                return;
            }

            data.cancelTimer--;
            const timerElement = document.getElementById(`cancel-timer-${id}`);
            if (timerElement) {
                timerElement.textContent = data.cancelTimer;
            }

            if (data.cancelTimer <= 0) {
                clearInterval(timer);
                const cancelButton = document.getElementById(`cancel-${id}`);
                if (cancelButton) {
                    cancelButton.disabled = false;
                }
            }
        }, 1000);
    }

    // 更新所有号码的倒计时
    updateAllTimers() {
        this.activeNumbers.forEach((data, id) => {
            const elapsedSeconds = Math.floor((Date.now() - data.startTime) / 1000);
            const remainingSeconds = 1200 - elapsedSeconds; // 20分钟 = 1200秒

            if (remainingSeconds <= 0) {
                this.cancelNumber(id);
            } else {
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                const timerElement = document.getElementById(`timer-${id}`);
                if (timerElement) {
                    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        });
    }

    startPolling(id) {
        const pollInterval = 5000; // 5秒轮询一次
        const poll = async () => {
            const data = this.activeNumbers.get(id);
            if (!data || !data.polling) return;

            // 更新轮询倒计时
            const pollTimerElement = document.getElementById(`poll-timer-${id}`);
            if (pollTimerElement) {
                pollTimerElement.textContent = `${data.pollTimer}s`;
            }

            if (data.pollTimer <= 0) {
                await this.getStatus(id);
                data.pollTimer = 5; // 重置倒计时
            } else {
                data.pollTimer--;
            }

            // 使用 requestAnimationFrame 来确保后台也能运行
            if (document.hidden) {
                setTimeout(poll, pollInterval);
            } else {
                requestAnimationFrame(() => setTimeout(poll, 1000));
            }
        };
        poll();
    }

    async setNumberStatus(id, status) {
        try {
            await fetch(`${this.BASE_URL}?api_key=${this.API_KEY}&action=setStatus&status=${status}&id=${id}`);
        } catch (error) {
            console.error('设置状态错误：', error);
        }
    }

    async cancelNumber(id) {
        this.showNotification('正在取消号码...', 'info');
        await this.setNumberStatus(id, 8);
        this.activeNumbers.delete(id);
        const element = document.getElementById(`number-${id}`);
        if (element) element.remove();
        this.saveNumbers();
        this.updateStats();
        this.showNotification('号码已取消', 'success');
    }

    async resendCode(id) {
        try {
            const response = await fetch(`${this.BASE_URL}?api_key=${this.API_KEY}&action=setStatus&status=3&id=${id}`);
            const data = await response.text();
            
            const statusElement = document.getElementById(`status-${id}`);
            if (data === 'ACCESS_RETRY_GET') {
                const numberData = this.activeNumbers.get(id);
                numberData.polling = true;
                this.startPolling(id);
                this.saveNumbers();
                
                // 显示成功消息，包含原始返回和中文说明
                statusElement.className = 'status waiting';
                statusElement.innerHTML = `
                    ${data}<br>
                    <small>重新获取验证码成功</small>
                    <div class="auto-fetch-timer">
                        <i class="fas fa-sync-alt"></i>
                        <span id="poll-timer-${id}">5</span>秒后自动获取
                    </div>
                `;
                this.showNotification('重新获取验证码成功', 'success');
            } else {
                // 显示失败消息，包含原始返回和中文说明
                statusElement.className = 'status error';
                statusElement.innerHTML = `
                    ${data}<br>
                    <small>重新获取验证码失败</small>
                `;
                this.showNotification('重新获取验证码失败', 'error');
            }
        } catch (error) {
            this.showNotification('重新获取验证码失败', 'error');
            console.error('重新获取验证码错误：', error);
        }
    }

    // 添加更新余额的方法
    async updateBalance() {
        try {
            const response = await fetch(`${this.BASE_URL}?api_key=${this.API_KEY}&action=getBalance`);
            const data = await response.text();
            
            if (data.startsWith('ACCESS_BALANCE:')) {
                const balance = data.split(':')[1].trim();
                const balanceAmount = document.getElementById('balance-amount');
                if (balanceAmount) {
                    balanceAmount.textContent = parseFloat(balance).toFixed(2);
                }
            }
        } catch (error) {
            console.error('获取余额失败：', error);
        }
    }

    // 配置音频可以在后台播放
    setupBackgroundAudio() {
        // iOS Safari需要这些设置来允许后台播放
        if (this.notificationSound) {
            this.notificationSound.setAttribute('playsinline', '');
            this.notificationSound.setAttribute('webkit-playsinline', '');
            this.notificationSound.setAttribute('preload', 'auto');
        }
    }

    // 播放提示音
    playNotificationSound() {
        // 强制加载并播放
        const playSound = async () => {
            try {
                await this.notificationSound.load();
                this.notificationSound.currentTime = 0;
                await this.notificationSound.play();
            } catch (error) {
                console.error('播放提示音失败:', error);
            }
        };
        
        // 如果是iOS设备，需要用户交互后才能播放
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            document.addEventListener('touchend', () => {
                playSound();
            }, { once: true });
        } else {
            playSound();
        }
    }

    // 添加通用复制文本方法
    async copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.error('复制失败:', err);
            // 降级处理
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    }
}

// 初始化
const smsManager = new SMSManager(); 