/**
 * 时间格式化工具
 */

/**
 * 将数字补零到指定位数
 */
function padZero(num: number, length = 2): string {
  return String(num).padStart(length, '0');
}

/**
 * 格式化秒数为时间字符串
 * @param seconds 秒数
 * @returns 格式化后的时间字符串 (HH:MM:SS 或 MM:SS)
 */
export function formatTime(seconds: number): string {
  if (Number.isNaN(seconds)) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${padZero(hours)}:${padZero(mins)}:${padZero(secs)}`;
  }

  return `${padZero(mins)}:${padZero(secs)}`;
}

/**
 * 播放倍速档位
 */
export const PLAYBACK_RATE_LEVELS = [3, 2, 1.5, 1, 0.5];
