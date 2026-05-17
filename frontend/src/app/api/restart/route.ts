import { NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';

export async function GET(): Promise<Response> {
  return new Promise((resolve) => {
    // Kill the existing uvicorn process
    exec('pkill -f uvicorn', (error, stdout, stderr) => {
      console.log('pkill uvicorn result:', error, stdout, stderr);
      
      // Give it a second to die, then respawn
      setTimeout(() => {
        const backendPath = '/home/aditya/Desktop/Sau-statup/backend';
        const uvicorn = spawn('.venv/bin/uvicorn', ['app.main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'], {
          cwd: backendPath,
          detached: true,
          stdio: 'ignore'
        });
        
        uvicorn.on('error', (err) => {
          console.error('Failed to start uvicorn:', err);
        });
        
        uvicorn.unref();
        
        resolve(NextResponse.json({ 
          success: true, 
          message: "Restarted backend",
          killed: !error
        }));
      }, 1000);
    });
  });
}
