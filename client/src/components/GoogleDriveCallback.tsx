import { useEffect } from 'react';
import { useRouter } from 'next/router';

const GoogleDriveCallback = () => {
  const router = useRouter();

  useEffect(() => {
    const { code } = router.query;

    if (code) {
      fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/google-drive/auth/callback?code=${code}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(response => response.json())
        .then(data => {
          // Store the access token securely (e.g., in HttpOnly cookie or encrypted in localStorage)
          localStorage.setItem('googleDriveAccessToken', data.access_token);
          
          // Redirect to the new workspace page
          router.push('/workspace/new');
        })
        .catch(error => {
          console.error('Error during Google Drive authentication:', error);
          // Handle error (e.g., show error message to user)
          router.push('/error');
        });
    }
  }, [router]);

  return <div>Processing Google Drive authentication...</div>;
};

export default GoogleDriveCallback;