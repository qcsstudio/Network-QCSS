'use server'
import { cookies } from 'next/headers';

export async function removeToken() {
    cookies().delete('token');
}
