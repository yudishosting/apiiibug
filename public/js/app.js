document.addEventListener("DOMContentLoaded", function () {
  const statusEl = document.getElementById("status");
  const pairingSection = document.getElementById("pairing-section");
  const messagingSection = document.getElementById("messaging-section");
  const qrPlaceholder = document.getElementById("qr-placeholder");
  const qrCodeImg = document.getElementById("qr-code");
  const sendResult = document.getElementById("send-result");
  
  const MIN_LOOP_COUNT = 1;
  const MIN_DELAY = 500;
  
  const loopCountInput = document.getElementById('loop-count');
  loopCountInput.setAttribute('min', MIN_LOOP_COUNT);
  loopCountInput.value = Math.max(parseInt(loopCountInput.value) || MIN_LOOP_COUNT, MIN_LOOP_COUNT);
  
  const delayInput = document.getElementById('delay');
  delayInput.setAttribute('min', MIN_DELAY);
  delayInput.value = Math.max(parseInt(delayInput.value) || MIN_DELAY, MIN_DELAY);
  
  loopCountInput.addEventListener('input', function() {
    if (parseInt(this.value) < MIN_LOOP_COUNT) {
      this.value = MIN_LOOP_COUNT;
    }
  });
  
  delayInput.addEventListener('input', function() {
    if (parseInt(this.value) < MIN_DELAY) {
      this.value = MIN_DELAY;
    }
  });
  
  loopCountInput.addEventListener('blur', function() {
    if (!this.value || parseInt(this.value) < MIN_LOOP_COUNT) {
      this.value = MIN_LOOP_COUNT;
    }
  });
  
  delayInput.addEventListener('blur', function() {
    if (!this.value || parseInt(this.value) < MIN_DELAY) {
      this.value = MIN_DELAY;
    }
  });
  
  let isLooping = false;
  let loopCounter = 0;
  let totalLoops = 0;
  let loopInterval = null;
  
  const templateCards = document.querySelectorAll('.template-card');
  
  templateCards.forEach(card => {
    card.addEventListener('click', function() {
      if (isLooping) {
        alert('Proses loop pesan sedang berjalan. Harap tunggu atau refresh halaman.');
        return;
      }
      
      const templateMessage = this.getAttribute('data-message');
      const messageType = this.getAttribute('data-type');
      const number = document.getElementById('number').value;
      
      let loopCount = parseInt(loopCountInput.value) || MIN_LOOP_COUNT;
      if (loopCount < MIN_LOOP_COUNT) {
        loopCount = MIN_LOOP_COUNT;
        loopCountInput.value = MIN_LOOP_COUNT;
      }
      
      let delay = parseInt(delayInput.value) || MIN_DELAY;
      if (delay < MIN_DELAY) {
        delay = MIN_DELAY;
        delayInput.value = MIN_DELAY;
      }
      
      if (!number) {
        alert('Silakan masukkan nomor telepon terlebih dahulu!');
        return;
      }
      
      sendResult.textContent = `Mengirim pesan (0/${loopCount})...`;
      sendResult.className = '';

      isLooping = true;
      loopCounter = 0;
      totalLoops = loopCount;
      
      function sendSingleMessage() {
        if (loopCounter >= totalLoops) {
          isLooping = false;
          clearInterval(loopInterval);
          sendResult.textContent = `Selesai! ${loopCounter} pesan berhasil dikirim.`;
          sendResult.className = 'success';
          return;
        }
        
        fetch('/api/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            number, 
            message: templateMessage, 
            messageType: messageType 
          }),
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            loopCounter++;
            sendResult.textContent = `Mengirim pesan (${loopCounter}/${totalLoops})...`;
          } else {
            sendResult.textContent = `Error: ${data.error} (${loopCounter}/${totalLoops})`;
            sendResult.className = 'error';
          }
        })
        .catch(error => {
          sendResult.textContent = `Error: ${error.message} (${loopCounter}/${totalLoops})`;
          sendResult.className = 'error';
        });
      }
      
      sendSingleMessage();
      loopInterval = setInterval(sendSingleMessage, delay);
    });
  });

  function updateStatus() {
    fetch("/api/status")
      .then((response) => response.json())
      .then((data) => {
        statusEl.textContent = `Status: ${
          data.state === "connected" ? "Terhubung" : "Tidak terhubung"
        }`;
        statusEl.className = `status ${data.state}`;

        if (data.state === "connected") {
          pairingSection.style.display = "none";
          messagingSection.style.display = "block";
        } else {
          pairingSection.style.display = "block";
          messagingSection.style.display = "none";

          if (data.qrCode) {
            qrPlaceholder.style.display = "none";
            qrCodeImg.style.display = "block";
            qrCodeImg.src = `/img/qr-code.png?t=${new Date().getTime()}`; // Force refresh
          } else {
            qrPlaceholder.style.display = "block";
            qrCodeImg.style.display = "none";
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching status:", error);
        statusEl.textContent = "Status: Error";
        statusEl.className = "status disconnected";
      });
  }

  updateStatus();
  setInterval(updateStatus, 5000);
  
  const stopLoopButton = document.createElement('button');
  stopLoopButton.textContent = 'Stop Loop';
  stopLoopButton.className = 'btn btn-danger';
  stopLoopButton.style.marginTop = '10px';
  stopLoopButton.style.backgroundColor = '#dc3545';
  stopLoopButton.addEventListener('click', function() {
    if (isLooping) {
      clearInterval(loopInterval);
      isLooping = false;
      sendResult.textContent = `Loop dihentikan. ${loopCounter} pesan berhasil dikirim.`;
      sendResult.className = 'warning';
    } else {
      alert('Tidak ada loop yang sedang berjalan.');
    }
  });
  
  document.getElementById('send-form').appendChild(stopLoopButton);
});
