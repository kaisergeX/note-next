import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

export const timeAgo = (
  timestamp: Date | string | null,
  timeOnly?: boolean,
): string => {
  if (!timestamp) {
    return 'never'
  }
  return dayjs(timestamp).fromNow(timeOnly)
}
