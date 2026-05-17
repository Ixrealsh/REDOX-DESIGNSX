export const firebaseConfig = {
  apiKey: "AIzaSyD4rIJfGT9SLfYQ1nbTMDmVIqoSsXHKSpg",
  authDomain: "redox-643e4.firebaseapp.com",
  databaseURL: "https://redox-643e4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "redox-643e4",
  storageBucket: "redox-643e4.firebasestorage.app",
  messagingSenderId: "811008788984",
  appId: "1:811008788984:web:ab543d4681305fcfd12e0d",
  measurementId: "G-KJ8H3L3QWQ"
};

/**
 * Signs in a user using the Firebase Auth REST API.
 * This does not require any local node_modules installation.
 */
export async function signInWithEmailAndPasswordRest(email: string, password: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Authentication failed');
  }

  return {
    idToken: data.idToken as string,
    email: data.email as string,
    localId: data.localId as string
  };
}
