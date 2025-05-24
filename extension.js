const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

let socket;
let panel;
let extensionContext;

/**
 * Fungsi utama untuk mengaktifkan ekstensi VS Code.
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    extensionContext = context;
    connectWebSocket();

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.taskSphere', () => {
            // Always check if panel is disposed or null before using it
            if (!panel || panel.disposed) {
                panel = createWebviewPanel();
            } else {
                // Panel exists and is not disposed, just reveal it
                panel.reveal(vscode.ViewColumn.One);
            }
        })
    );
}

function connectWebSocket() {
    socket = new WebSocket('wss://websocket-task-sphere-production.up.railway.app');
    
    socket.on('open', () => {
        console.log('Connected to WebSocket server');
    });
    
    socket.on('message', (data) => {
        try {
            // Convert the data to string if it's not already
            const dataString = data.toString();
            
            // Parse the string data to JSON
            const message = JSON.parse(dataString);
            
            // Handle different types of updates
            handleDataUpdate(message);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });
    
    socket.on('close', () => {
        console.log('Disconnected from server, attempting to reconnect...');
        setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
    });
    
    socket.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
}

function handleDataUpdate(message) {
    // Check if panel exists and is not disposed before using it
    if (!panel || panel.disposed) {
        // Don't automatically create panel here - only create when user explicitly opens it
        console.log('Panel not available for message update');
        return;
    }
    
    // Send the updated data to the webview
    try {
        panel.webview.postMessage(message);
    } catch (error) {
        console.error('Error posting message to webview:', error);
        // If there's an error, the panel might be disposed
        panel = null;
    }
}

function createWebviewPanel() {
    // Create and show panel
    const newPanel = vscode.window.createWebviewPanel(
        'taskSphere',
        'Task Sphere',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Ambil path file index.html
    const indexPath = path.join(extensionContext.extensionPath, 'index.html');

    // Baca file index.html dan muat ke dalam WebView
    fs.readFile(indexPath, 'utf8', (err, data) => {
        if (err) {
            vscode.window.showErrorMessage('Gagal memuat report.html');
            return;
        }
        
        // Check if panel is still valid before setting HTML
        if (!newPanel.disposed) {
            newPanel.webview.html = data;
        }
    });
    
    // Handle messages from the webview
    newPanel.webview.onDidReceiveMessage(
        message => {
            // Handle UI interactions here
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(message));
            }
        },
        undefined,
        extensionContext.subscriptions
    );
    
    // Handle panel disposal - THIS IS CRITICAL
    newPanel.onDidDispose(() => {
        // Set panel to null when it's disposed
        panel = null;
        console.log('Panel disposed');
    }, null, extensionContext.subscriptions);
    
    return newPanel;
}

function deactivate() {
    if (socket) {
        socket.close();
    }
    
    // Clean up panel reference
    if (panel) {
        panel.dispose();
        panel = null;
    }
}

module.exports = { 
    activate,
    deactivate
};