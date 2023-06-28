export function classNames(...classes: string[]): string {
  return classes.filter(Boolean).join(' ')
}

export const sleep = (millis = 0) => {
  return new Promise((resolve) => setTimeout(resolve, millis))
}
