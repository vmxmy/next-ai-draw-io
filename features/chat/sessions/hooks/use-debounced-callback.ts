import { useCallback, useEffect, useRef } from "react"

/**
 * 带自动清理的防抖 hook
 *
 * 解决原有 debounce 函数的内存泄漏问题：
 * - 组件卸载时自动清理 pending timeout
 * - 使用 ref 保持 callback 最新引用，避免闭包过期
 *
 * @param callback 需要防抖的回调函数
 * @param wait 防抖延迟时间（毫秒）
 * @returns [debouncedCallback, cancel] - 防抖后的回调和取消函数
 *
 * @example
 * ```tsx
 * const [debouncedSave, cancelSave] = useDebouncedCallback(
 *     (data) => saveToServer(data),
 *     300
 * )
 *
 * // 使用防抖回调
 * debouncedSave(newData)
 *
 * // 需要立即执行时，先取消再直接调用
 * cancelSave()
 * saveToServer(data)
 * ```
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    wait: number,
): [(...args: Parameters<T>) => void, () => void] {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const callbackRef = useRef(callback)

    // 保持 callback ref 最新，避免闭包过期
    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    // 组件卸载时清理 pending timeout
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }
    }, [])

    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = null
                callbackRef.current(...args)
            }, wait)
        },
        [wait],
    )

    const cancel = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
    }, [])

    return [debouncedCallback, cancel]
}

/**
 * 立即执行一次后进入防抖模式的 hook
 *
 * @param callback 需要防抖的回调函数
 * @param wait 防抖延迟时间（毫秒）
 * @returns [debouncedCallback, cancel, flush] - 防抖回调、取消函数、立即执行函数
 */
export function useDebouncedCallbackWithFlush<
    T extends (...args: any[]) => any,
>(
    callback: T,
    wait: number,
): [
    (...args: Parameters<T>) => void,
    () => void,
    (...args: Parameters<T>) => void,
] {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const callbackRef = useRef(callback)
    const pendingArgsRef = useRef<Parameters<T> | null>(null)

    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }
    }, [])

    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            pendingArgsRef.current = args
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = null
                if (pendingArgsRef.current) {
                    callbackRef.current(...pendingArgsRef.current)
                    pendingArgsRef.current = null
                }
            }, wait)
        },
        [wait],
    )

    const cancel = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }
        pendingArgsRef.current = null
    }, [])

    const flush = useCallback(
        (...args: Parameters<T>) => {
            cancel()
            callbackRef.current(...args)
        },
        [cancel],
    )

    return [debouncedCallback, cancel, flush]
}
