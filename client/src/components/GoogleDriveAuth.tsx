import React from 'react';

interface GoogleDriveAuthProps {
  callbackUrl: string;
}

const GoogleDriveAuth: React.FC<GoogleDriveAuthProps> = ({ callbackUrl }) => {
  const handleAuth = async () => {
    try {
      // Save the current path
      const currentPath = window.location.pathname;
      localStorage.setItem('googleDriveAuthReturnPath', currentPath);
      
      const url = `${process.env.NEXT_PUBLIC_SERVER_URL}/api/google-drive/auth?redirect_uri=${encodeURIComponent(callbackUrl)}`;
      console.log('url', url)
      const response = await fetch(url, { method: "GET" });
      console.log('response', response)
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        console.error('Failed to get auth URL');
      }
    } catch (error) {
      console.error('Error initiating Google Drive auth:', error);
    }
  };

  return (
    <button
      onClick={handleAuth}
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
    >
      Authorize Google Drive
    </button>
  );
};

export default GoogleDriveAuth;