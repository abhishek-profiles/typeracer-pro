import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        return false;
      }

      const response = await axios.get(`${API_URL}/api/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUser(response.data);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getToken = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      return null;
    }

    try {
      const response = await axios.get(`${API_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.valid) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return token;
      }

      try {
        const refreshResponse = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (refreshResponse.data.token) {
          const newToken = refreshResponse.data.token;
          localStorage.setItem('token', newToken);
          axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          if (refreshResponse.data.user) {
            setUser(refreshResponse.data.user);
          }
          return newToken;
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Handle specific refresh errors if needed
      }

      // If refresh fails or no new token received
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      return null;
    } catch (error) {
      console.error('Token validation error:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
      }
      return null;
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password,
    });
    const { token, user: userData } = response.data;
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    return userData;
  };

  const register = async (username, email, password) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      username,
      email,
      password,
    });
    const { token, user: userData } = response.data;
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    getToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-400">Authenticating...</p>
          </div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthProvider, AuthContext, useAuth };
