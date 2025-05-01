// === 1. Lấy phần tử #main-message và xóa tiêu đề cũ ===
const mainMessage = document.querySelector('#main-message');

// Xoá dòng "Nhấn phím cách để chơi"
const h1 = mainMessage.querySelector('h1');
if (h1) h1.remove();

// === 2. Tạo vùng điều khiển mới ===
const controlWrapper = document.createElement('div');
controlWrapper.style.marginTop = '20px';
controlWrapper.style.display = 'flex';
controlWrapper.style.alignItems = 'center';

// Input tốc độ
const speedInput = Object.assign(document.createElement('input'), {
    type: 'number',
    placeholder: 'Tốc độ',
    value: '1000',
    style: 'margin-left:10px; width:60px;'
});

// Nút xác nhận
const confirmButton = Object.assign(document.createElement('button'), {
    textContent: 'Enter',
    style: 'margin-left:5px; padding:2px 6px; cursor:pointer;'
});

// Gắn input và nút vào controlWrapper
controlWrapper.append(speedInput, confirmButton);
mainMessage.appendChild(controlWrapper);

// === 3. Thêm hướng dẫn phím tắt ===
const info = document.createElement('div');
info.style.cssText = 'margin-top:10px; font-size:12px; line-height:1.4;';
info.innerHTML = `
  <b>Phím tắt:</b><br>
  1: Vô hiệu gameOver + tốc độ theo input.<br>
  2: Khôi phục trạng thái mặc định.<br>
  3: Tốc độ 50 + kéo vật cản xuống yPos = 40.<br>
  5: Tốc độ 50 + tự động nhảy khi vật thể thấp.<br><br>
  <span style="font-size:11px; color:gray;">© 2025 Bản quyền thuộc về hưnglunna</span>
`;
mainMessage.appendChild(info);

// === 4. Logic xử lý phím tắt ===
let originalGameOver = null;
let yPosInterval, autoJumpInterval;

document.addEventListener('keydown', ({ key }) => {
    switch (key) {
        case '1':
            if (!originalGameOver) originalGameOver = Runner.prototype.gameOver;
            Runner.prototype.gameOver = () => {};
            Runner.instance_.setSpeed(parseInt(speedInput.value) || 1000);
            break;
        case '2':
            if (originalGameOver) {
                Runner.prototype.gameOver = originalGameOver;
                originalGameOver = null;
            }
            clearInterval(yPosInterval);
            clearInterval(autoJumpInterval);
            break;
        case '3':
            Runner.instance_.setSpeed(50);
            clearInterval(yPosInterval);
            yPosInterval = setInterval(() => {
                const obs = Runner.instance_.horizon.obstacles;
                if (obs.length > 0) obs[0].yPos = 40;
            }, 1);
            break;
        case '5':
            Runner.instance_.setSpeed(50);
            clearInterval(autoJumpInterval);
            autoJumpInterval = setInterval(() => {
                const obs = Runner.instance_.horizon.obstacles;
                Runner.instance_.tRex.yPos = (obs.length > 0 && obs[0].yPos > 70) ? 40 : 105;
            }, 1);
            break;
    }
});

// === 5. Xử lý nút Enter ===
confirmButton.addEventListener('click', () => {
    const speed = parseInt(speedInput.value);
    if (!isNaN(speed)) {
        Runner.instance_.setSpeed(speed);
    }
});
