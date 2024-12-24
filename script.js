document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    const textInput = document.getElementById('textInput');
    const textPositionRadios = document.getElementsByName('textPosition');
    const resolutionRadios = document.getElementsByName('resolution');
    const customResolutionContainer = document.getElementById('customResolutionContainer');
    const customResolutionInput = document.getElementById('customResolution');
    const fontSelect = document.getElementById('fontSelect');
    const fontSizeInput = document.getElementById('fontSize');
    const fontSizeDisplay = document.getElementById('fontSizeDisplay');
    const textColorInput = document.getElementById('textColor');
    const textColorHex = document.getElementById('textColorHex');
    const backgroundColorInput = document.getElementById('backgroundColor');
    const backgroundColorHex = document.getElementById('backgroundColorHex');
    const copyButton = document.getElementById('copyButton');
    const downloadButton = document.getElementById('downloadButton');
    const previewCanvas = document.getElementById('previewCanvas');
    const result = document.getElementById('result');
    const loadingIndicator = document.getElementById('loading');
    const dropArea = document.getElementById('dropArea');
    let originalImage = null;
    let cachedImageDataURL = null;

    fontSizeDisplay.textContent = `${fontSizeInput.value}px`;

    resolutionRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'custom') {
                customResolutionContainer.classList.remove('hidden');
            } else {
                customResolutionContainer.classList.add('hidden');
            }
            updatePreview();
        });
    });

    textInput.addEventListener('input', debounce(updatePreview, 200));
    textPositionRadios.forEach(radio => radio.addEventListener('change', updatePreview));
    resolutionRadios.forEach(radio => radio.addEventListener('change', updatePreview));
    customResolutionInput.addEventListener('input', debounce(updatePreview, 200));
    fontSelect.addEventListener('change', updatePreview);

    fontSizeInput.addEventListener('input', () => {
        fontSizeDisplay.textContent = `${fontSizeInput.value}px`;
        updatePreview();
    });

    textColorInput.addEventListener('input', () => {
        textColorHex.value = textColorInput.value;
        updatePreview();
    });

    textColorHex.addEventListener('input', () => {
        if (/^#([0-9A-F]{3}){1,2}$/i.test(textColorHex.value)) {
            textColorInput.value = textColorHex.value;
            updatePreview();
        }
    });

    backgroundColorInput.addEventListener('input', () => {
        backgroundColorHex.value = backgroundColorInput.value;
        updatePreview();
    });

    backgroundColorHex.addEventListener('input', () => {
        if (/^#([0-9A-F]{3}){1,2}$/i.test(backgroundColorHex.value)) {
            backgroundColorInput.value = backgroundColorHex.value;
            updatePreview();
        }
    });

    copyButton.addEventListener('click', copyToClipboard);
    downloadButton.addEventListener('click', downloadImage);
    imageInput.addEventListener('change', handleImageUpload);

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('dragover');
        }, false);
    });

    dropArea.addEventListener('drop', handleDrop, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            imageInput.files = files;
            handleImageUpload({ target: imageInput });
        }
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    originalImage = img;
                    updatePreview();
                }
                img.src = e.target.result;
            }
            reader.readAsDataURL(file);
        }
    }

    function debounce(func, delay) {
        let debounceTimer;
        return function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(this, arguments), delay);
        }
    }

    function getSelectedTextPosition() {
        for (const radio of textPositionRadios) {
            if (radio.checked) return radio.value;
        }
    }

    function getSelectedResolution() {
        for (const radio of resolutionRadios) {
            if (radio.checked) {
                if (radio.value === 'custom') {
                    const custom = customResolutionInput.value.trim();
                    const match = custom.match(/^(\d+)x(\d+)$/i);
                    if (match) {
                        return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
                    }
                    return null;
                }
                const [width, height] = radio.value.split('x').map(Number);
                return { width, height };
            }
        }
    }

    function updatePreview() {
        if (!originalImage) {
            clearCanvas();
            return;
        }
        const text = textInput.value.trim();
        if (!text) {
            clearCanvas();
            return;
        }
        const position = getSelectedTextPosition();
        const resolution = getSelectedResolution();
        if (!resolution) {
            result.textContent = 'Invalid custom resolution format.';
            result.classList.remove('success');
            result.classList.add('error');
            clearCanvas();
            return;
        }
        loadingIndicator.classList.remove('hidden');
        try {
            const fontSize = parseInt(fontSizeInput.value, 10);
            const selectedFont = fontSelect.value === 'Courier New' ? `'Courier New', monospace` : `'${fontSelect.value}', sans-serif`;
            const ctxTemp = document.createElement('canvas').getContext('2d');
            ctxTemp.font = `${fontSize}px ${selectedFont}`;
            const maxTextWidth = resolution.width - 100;
            const lines = wrapText(ctxTemp, text, maxTextWidth);
            const lineHeight = fontSize * 1.2;
            const textBlockHeight = lines.length * lineHeight + 20;
            const canvasWidth = resolution.width;
            const canvasHeight = resolution.height;
            const imageAreaHeight = canvasHeight - textBlockHeight;
            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#2c2c2c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const x = 0;
            const y = position === 'above' ? textBlockHeight : 0;
            const aspectRatio = originalImage.width / originalImage.height;
            const targetAspectRatio = canvasWidth / imageAreaHeight;
            let drawWidth, drawHeight, srcX, srcY, srcWidth, srcHeight;
            if (aspectRatio > targetAspectRatio) {
                drawHeight = imageAreaHeight;
                drawWidth = originalImage.width * (imageAreaHeight / originalImage.height);
                srcX = (originalImage.width - canvasWidth * (originalImage.height / imageAreaHeight)) / 2;
                srcY = 0;
                srcWidth = canvasWidth * (originalImage.height / imageAreaHeight);
                srcHeight = originalImage.height;
            } else {
                drawWidth = canvasWidth;
                drawHeight = originalImage.height * (canvasWidth / originalImage.width);
                srcX = 0;
                srcY = (originalImage.height - imageAreaHeight * (originalImage.width / canvasWidth)) / 2;
                srcWidth = originalImage.width;
                srcHeight = imageAreaHeight * (originalImage.width / canvasWidth);
            }
            ctx.drawImage(originalImage, srcX, srcY, srcWidth, srcHeight, x, y, canvasWidth, imageAreaHeight);
            ctx.font = `${fontSize}px ${selectedFont}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let textY = position === 'above' ? textBlockHeight / 2 : canvasHeight - textBlockHeight / 2;
            ctx.fillStyle = backgroundColorInput.value;
            ctx.fillRect(0, textY - textBlockHeight / 2, canvas.width, textBlockHeight);
            ctx.fillStyle = textColorInput.value;
            lines.forEach((line, index) => {
                ctx.fillText(line, canvas.width / 2, textY - textBlockHeight / 2 + (index + 0.5) * lineHeight + 10);
            });
            previewCanvas.width = canvasWidth / 2;
            previewCanvas.height = canvasHeight / 2;
            const previewCtx = previewCanvas.getContext('2d');
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            previewCtx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
            cachedImageDataURL = canvas.toDataURL('image/png');
            result.textContent = '';
            result.classList.remove('error');
            result.classList.add('success');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    }

    function clearCanvas() {
        const ctx = previewCanvas.getContext('2d');
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#e0e0e0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Preview will appear here.', previewCanvas.width / 2, previewCanvas.height / 2);
    }

    function wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        words.forEach(word => {
            const testLine = currentLine + word + ' ';
            if (ctx.measureText(testLine).width > maxWidth && currentLine !== '') {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        });
        lines.push(currentLine.trim());
        return lines;
    }

    async function copyToClipboard() {
        if (!cachedImageDataURL) {
            result.textContent = 'No image to copy. Please generate a preview first.';
            result.classList.remove('success');
            result.classList.add('error');
            return;
        }
        try {
            const response = await fetch(cachedImageDataURL);
            const blob = await response.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            result.textContent = 'Image copied to clipboard!';
            result.classList.remove('error');
            result.classList.add('success');
        } catch {
            result.textContent = 'Failed to copy image.';
            result.classList.remove('success');
            result.classList.add('error');
        }
    }

    function downloadImage() {
        if (!cachedImageDataURL) {
            result.textContent = 'No image to download. Please generate a preview first.';
            result.classList.remove('success');
            result.classList.add('error');
            return;
        }
        const link = document.createElement('a');
        link.href = cachedImageDataURL;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `meme_${timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        result.textContent = 'Image downloaded successfully!';
        result.classList.remove('error');
        result.classList.add('success');
    }
});
