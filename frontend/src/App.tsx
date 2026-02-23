import axios, { type AxiosInstance } from "axios";
import CryptoJS from "crypto-js";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type Student = {
  _id: string;
  name: string;
  studentId: string;
  grade: string;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const oauthClientId = import.meta.env.VITE_CLIENT_ID || "";
const oauthClientSecret = import.meta.env.VITE_CLIENT_SECRET || "";

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const wordArrayFromBytes = (bytes: Uint8Array) =>
  CryptoJS.enc.Hex.parse(bytesToHex(bytes));

const base64FromBytes = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
};

const importRsaPublicKey = async (pem: string) => {
  const normalized = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const key = await window.crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );

  console.log("Public key loaded");
  return key;
};

function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    studentId: "",
    grade: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const publicKeyRef = useRef<CryptoKey | null>(null);

  const api: AxiosInstance = useMemo(() => {
    const instance = axios.create({ baseURL: apiBaseUrl });
    instance.interceptors.request.use((config) => {
      if (tokenRef.current) {
        config.headers.Authorization = `Bearer ${tokenRef.current}`;
      }
      return config;
    });
    return instance;
  }, []);

  const fetchStudents = async () => {
    const response = await api.get<Student[]>("/students");
    setStudents(response.data);
  };

  const initialize = async () => {
    setError(null);
    setStatus("Requesting access token...");

    if (!oauthClientId || !oauthClientSecret) {
      setStatus("Missing OAuth credentials");
      return;
    }

    const tokenResponse = await axios.post(`${apiBaseUrl}/token`, {
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
    });

    tokenRef.current = tokenResponse.data.access_token;

    console.log(
      "Access token received:",
      tokenRef.current?.slice(0, 20) + "..."
    );

    const publicKeyResponse = await axios.get(`${apiBaseUrl}/public-key`, {
      responseType: "text",
    });

    publicKeyRef.current = await importRsaPublicKey(publicKeyResponse.data);

    await fetchStudents();
    setStatus("Ready");
  };

  useEffect(() => {
    initialize().catch((err) => {
      setError(err?.message || "Initialization failed");
      setStatus("Initialization failed");
    });
  }, []);

  const encryptPayload = async (payload: object) => {
    if (!publicKeyRef.current) {
      throw new Error("Public key not loaded");
    }

    const aesKey = new Uint8Array(32);
    const iv = new Uint8Array(16);
    window.crypto.getRandomValues(aesKey);
    window.crypto.getRandomValues(iv);

    console.log("AES key (hex):", bytesToHex(aesKey).slice(0, 32) + "...");
    console.log("IV (hex):", bytesToHex(iv));

    const keyWordArray = wordArrayFromBytes(aesKey);
    const ivWordArray = wordArrayFromBytes(iv);
    const plaintext = JSON.stringify(payload);

    const encryptedData = CryptoJS.AES.encrypt(plaintext, keyWordArray, {
      iv: ivWordArray,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }).ciphertext.toString(CryptoJS.enc.Base64);

    const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKeyRef.current,
      aesKey
    );

    console.log(
      "Encrypted data (preview):",
      encryptedData.slice(0, 40) + "..."
    );

    return {
      encryptedKey: base64FromBytes(new Uint8Array(encryptedKeyBuffer)),
      encryptedData,
      iv: base64FromBytes(iv),
    };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      const encryptedPayload = await encryptPayload(formData);

      if (editId) {
        console.log("Sending encrypted UPDATE request");
        await api.put(`/students/${editId}`, encryptedPayload);
        console.log("Student updated successfully");
      } else {
        console.log("Sending encrypted CREATE request");
        await api.post("/students", encryptedPayload);
        console.log("Student created successfully");
      }

      setFormData({ name: "", studentId: "", grade: "" });
      setEditId(null);
      await fetchStudents();
    } catch (err: any) {
      setError(err?.message || "Failed to save student");
    }
  };

  const handleEdit = (student: Student) => {
    setFormData(student);
    setEditId(student._id);
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      console.log("Sending protected DELETE request");
      await api.delete(`/students/${id}`);
      console.log("Student deleted successfully");
      await fetchStudents();
    } catch (err: any) {
      setError(err?.message || "Failed to delete student");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 text-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Student Management Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-2">{status}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 text-red-600 px-5 py-3 text-sm shadow-sm">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">

          <div className="bg-white/80 backdrop-blur shadow-lg border border-gray-100 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-6">
              {editId ? "Update Student" : "Create Student"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {["name", "studentId", "grade"].map((field) => (
                <div key={field}>
                  <label className="block text-sm text-gray-600 mb-1 capitalize">
                    {field}
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    value={(formData as any)[field]}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [field]: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              ))}

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 shadow-md transition"
              >
                {editId ? "Update" : "Create"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white/80 backdrop-blur shadow-lg border border-gray-100 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-6">Students</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Student ID</th>
                    <th className="pb-3 font-medium">Grade</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student._id} className="border-b">
                      <td className="py-4">{student.name}</td>
                      <td className="py-4">{student.studentId}</td>
                      <td className="py-4">{student.grade}</td>
                      <td className="py-4 text-right space-x-2">
                        <button
                          onClick={() => handleEdit(student)}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(student._id)}
                          className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;