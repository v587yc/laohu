class SMSManager {
    constructor() {
        this.API_KEY = 'U7L2XoZEwn5DAExpvuoBFJNzi0iq2fx2';
        // 使用 cors-anywhere 代理
        this.BASE_URL = 'https://your-worker.your-name.workers.dev';
        // 或者使用 allorigins
        // this.BASE_URL = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://api.tiger-sms.com/stubs/handler_api.php');
        this.activeNumbers = new Map();
        this.statusMap = {
            'STATUS_WAIT_CODE': '等待接收验证码中...',
            'STATUS_WAIT_RESEND': '等待重新发送验证码...',
            'STATUS_CANCEL': '已取消',
            'STATUS_OK': '验证码'
        };
        this.init();
        this.loadSavedNumbers();
        this.updateStats();
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

    // 更新统计数据
    updateStats() {
        const activeCount = document.getElementById('active-count');
        const successCount = document.getElementById('success-count');
        
        activeCount.textContent = this.activeNumbers.size;
        successCount.textContent = Array.from(this.activeNumbers.values())
            .filter(n => !n.polling).length;
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
        
        item.innerHTML = `
            <div class="number" onclick="navigator.clipboard.writeText('${displayNumber}')">
                <i class="fas fa-sim-card"></i>
                ${number}
            </div>
            <div class="status waiting" id="status-${id}">${this.statusMap['STATUS_WAIT_CODE']}</div>
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
                    取消
                </button>
            </div>
        `;
        
        numbersList.insertBefore(item, numbersList.firstChild);
        this.activeNumbers.set(id, { 
            number, 
            polling: true, 
            startTime: startTime 
        });
        
        // 2分钟后启用取消按钮
        setTimeout(() => {
            const cancelButton = document.getElementById(`cancel-${id}`);
            if (cancelButton) {
                cancelButton.disabled = false;
            }
        }, 120000);

        this.saveNumbers();
        this.updateStats();
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

    async getStatus(id) {
        try {
            const response = await fetch(`${this.BASE_URL}?api_key=${this.API_KEY}&action=getStatus&id=${id}`);
            const status = await response.text();
            const statusElement = document.getElementById(`status-${id}`);
            
            if (status.startsWith('STATUS_OK:')) {
                const code = status.split(':')[1].trim();
                statusElement.className = 'status success';
                statusElement.innerHTML = `${this.statusMap['STATUS_OK']}: <span class="code" onclick="navigator.clipboard.writeText('${code}')">${code}</span>`;
                this.activeNumbers.get(id).polling = false;
                this.saveNumbers();
            } else {
                const statusKey = Object.keys(this.statusMap).find(key => status.startsWith(key));
                if (statusKey) {
                    statusElement.className = 'status waiting';
                    statusElement.textContent = this.statusMap[statusKey];
                } else {
                    statusElement.className = 'status error';
                    statusElement.textContent = status;
                }
            }
        } catch (error) {
            console.error('获取状态错误：', error);
        }
    }

    startPolling(id) {
        const poll = () => {
            if (this.activeNumbers.has(id) && this.activeNumbers.get(id).polling) {
                this.getStatus(id);
                setTimeout(poll, 5000);
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
        await this.setNumberStatus(id, 3);
        this.activeNumbers.get(id).polling = true;
        this.startPolling(id);
        this.saveNumbers();
    }
}

// 初始化
const smsManager = new SMSManager(); 