class SMSManager {
    constructor() {
        this.API_KEY = 'U7L2XoZEwn5DAExpvuoBFJNzi0iq2fx2';
        this.BASE_URL = 'https://laohu-nu.vercel.app/sms';
        this.activeNumbers = new Map();
        this.statusMap = {
            'STATUS_WAIT_CODE': '等待接收验证码中...',
            'STATUS_WAIT_RESEND': '等待重新发送验证码...',
            'STATUS_CANCEL': '已取消',
            'STATUS_OK': '验证码'
        };
        
        // 添加用户相关属性
        this.currentUser = null;
        this.validUsers = ['594120', 'jq'];
        this.userHistory = new Map();
        
        // 初始化 Firebase
        const firebaseConfig = {
            apiKey: "YVHbqJ7lDQHvpb9VGMMwbGdvoJ5OVwG0ei6q85oat",
            authDomain: "your-app.firebaseapp.com",
            databaseURL: "https://your-app.firebaseio.com",
            projectId: "your-project-id",
            storageBucket: "your-app.appspot.com",
            messagingSenderId: "your-sender-id",
            appId: "your-app-id"
        };
        
        firebase.initializeApp(firebaseConfig);
        this.database = firebase.database();
        
        this.HISTORY_API = 'https://your-domain.com/history-api.php'; // 替换为你的服务器地址
        
        this.initLogin();
        this.initTabs();
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
        const activeCount = document.getElementById('active-count');
        const successCount = document.getElementById('success-count');
        const historyCount = document.getElementById('history-count');
        
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
                statusElement.innerHTML = `${this.statusMap['STATUS_OK']}: <span class="code" onclick="navigator.clipboard.writeText('${code}')">${code}</span>`;
                data.polling = false;
                
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
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notification-text');
        
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
        
        // 添加 onclick 事件到整个 number-item
        item.onclick = (e) => {
            // 如果点击的是按钮，不执行复制
            if (e.target.closest('.action-button')) {
                return;
            }
            this.copyNumber(displayNumber);
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
        const poll = () => {
            const data = this.activeNumbers.get(id);
            if (!data || !data.polling) return;

            // 更新轮询倒计时
            const pollTimerElement = document.getElementById(`poll-timer-${id}`);
            if (pollTimerElement) {
                pollTimerElement.textContent = `${data.pollTimer}s`;
            }

            if (data.pollTimer <= 0) {
                this.getStatus(id);
                data.pollTimer = 5; // 重置倒计时
            } else {
                data.pollTimer--;
            }

            setTimeout(poll, 1000);
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
}

// 初始化
const smsManager = new SMSManager(); 