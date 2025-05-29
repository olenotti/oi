import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://biabzvzrmerudhzcmgcv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYWJ6dnpybWVydWRoemNtZ2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NTkxMTAsImV4cCI6MjA2NDEzNTExMH0.Kq2wBbsyPAJbjp7MIxDurT-zXV76qEWlT-hwuhwddxg'
export const supabase = createClient(supabaseUrl, supabaseKey)