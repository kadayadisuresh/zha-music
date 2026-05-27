export interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
}

export async function shareContent(options: ShareOptions): Promise<boolean> {
  // Check if we are on a mobile device and navigator.share is available
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile && navigator.share) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing natively:', error);
      }
      return false;
    }
  }
  
  return false;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      return new Promise((res, rej) => {
        document.execCommand('copy') ? res(true) : rej();
        textArea.remove();
      });
    }
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
}
