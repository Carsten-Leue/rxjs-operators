export const isEqual = (aLeft: any, aRight: any) => aLeft === aRight;

export const arrayPush: (<T>(aObj: T, aDst: T[]) => T[]) = (aObj, aDst) => {
    aDst.push(aObj);
    return aDst;
}

export function isNotNil<T>(aValue: T | null | undefined): aValue is T {
    return aValue != null;
}