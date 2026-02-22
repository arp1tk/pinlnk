import axios, { type AxiosInstance } from "axios";
import CryptoJS from "crypto-js";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import "./App.css";

/* ===========================
   DEBUG LOGGER
=========================== */

const DEBUG = true;

const log = (...args: any[]) => {
  if (DEBUG) {
    console.log("[DEBUG]", ...args);
  }
};

const logError = (...args: any[]) => {
  console.error("[ERROR]", ...args);
};

/* ===========================
   TYPES
=========================== */

type Student = {
  _id: string;
  name: string;
  studentId: string;
  grade: string;
};

/* ===========================
   ENV CONFIG
=========================== */

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const oauthClientId = import.meta.env.VITE_CLIENT_ID || "";
const oauthClientSecret = import.meta.env.VITE_CLIENT_SECRET || "";

/* ===========================
   HELPER FUNCTIONS
=========================== */

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
  log("Importing RSA Public Key...");

  const normalized = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");

  log("Normalized PEM:", normalized);

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const key = await window.crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );

  log("RSA Public Key Imported Successfully:", key);
  return key;
};

/* ===========================
   COMPONENT
=========================== */

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

  /* ===========================
     AXIOS INSTANCE
  =========================== */

  const api: AxiosInstance = useMemo(() => {
    const instance = axios.create({ baseURL: apiBaseUrl });

    instance.interceptors.request.use((config) => {
      if (tokenRef.current) {
        config.headers.Authorization = `Bearer ${tokenRef.current}`;
      }
      log("Outgoing Request:", config.method?.toUpperCase(), config.url);
      return config;
    });

    return instance;
  }, []);

  /* ===========================
     FETCH STUDENTS
  =========================== */

  const fetchStudents = async () => {
    try {
      log("Fetching students...");
      const response = await api.get<Student[]>("/students");
      log("Students response:", response.data);
      setStudents(response.data);
    } catch (err) {
      logError("Error fetching students:", err);
    }
  };

  /* ===========================
     INITIALIZE
  =========================== */

  const initialize = async () => {
    setError(null);
    setStatus("Requesting access token...");
    log("Initializing application...");
    log("API Base URL:", apiBaseUrl);

    if (!oauthClientId || !oauthClientSecret) {
      logError("Missing OAuth credentials");
      setStatus("Missing OAuth client credentials in frontend env");
      return;
    }

    log("Requesting OAuth token...");
    const tokenResponse = await axios.post(`${apiBaseUrl}/token`, {
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
    });

    tokenRef.current = tokenResponse.data.access_token;
    log("Access Token received:", tokenRef.current);

    setStatus("Fetching public key...");

    log("Requesting public key...");
    const publicKeyResponse = await axios.get(`${apiBaseUrl}/public-key`, {
      responseType: "text",
    });

    publicKeyRef.current = await importRsaPublicKey(
      publicKeyResponse.data
    );

    setStatus("Loading students...");
    await fetchStudents();

    setStatus("Ready");
    log("Initialization complete ✅");
  };

  useEffect(() => {
    initialize().catch((initError) => {
      logError("Initialization failed:", initError);
      setError(initError?.message || "Initialization failed");
      setStatus("Initialization failed");
    });
  }, []);

  /* ===========================
     ENCRYPT PAYLOAD
  =========================== */

  const encryptPayload = async (payload: object) => {
    log("Encrypting payload:", payload);

    if (!publicKeyRef.current) {
      logError("Public key not loaded");
      throw new Error("Public key not loaded");
    }

    const aesKey = new Uint8Array(32);
    const iv = new Uint8Array(16);

    window.crypto.getRandomValues(aesKey);
    window.crypto.getRandomValues(iv);

    log("Generated AES Key:", aesKey);
    log("Generated IV:", iv);

    const keyWordArray = wordArrayFromBytes(aesKey);
    const ivWordArray = wordArrayFromBytes(iv);

    const plaintext = JSON.stringify(payload);
    log("Plaintext JSON:", plaintext);

    const encryptedData = CryptoJS.AES.encrypt(plaintext, keyWordArray, {
      iv: ivWordArray,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }).ciphertext.toString(CryptoJS.enc.Base64);

    log("AES Encrypted Data:", encryptedData);

    const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKeyRef.current,
      aesKey
    );

    const encryptedKey = base64FromBytes(
      new Uint8Array(encryptedKeyBuffer)
    );

    log("RSA Encrypted AES Key:", encryptedKey);
    log("IV Base64:", base64FromBytes(iv));

    return {
      encryptedKey,
      encryptedData,
      iv: base64FromBytes(iv),
    };
  };

  /* ===========================
     HANDLE SUBMIT
  =========================== */

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    log("Form submitted");
    log("Form Data:", formData);
    log("Edit ID:", editId);

    try {
      const encryptedPayload = await encryptPayload(formData);
      log("Encrypted Payload:", encryptedPayload);

      if (editId) {
        log("Sending PUT request...");
        await api.put(`/students/${editId}`, encryptedPayload);
      } else {
        log("Sending POST request...");
        await api.post("/students", encryptedPayload);
      }

      log("Student saved successfully ✅");

      setFormData({ name: "", studentId: "", grade: "" });
      setEditId(null);
      await fetchStudents();
    } catch (submitError: any) {
      logError("Submit Error:", submitError);
      setError(submitError?.message || "Failed to save student");
    }
  };

  /* ===========================
     EDIT
  =========================== */

  const handleEdit = (student: Student) => {
    log("Editing student:", student);
    setFormData({
      name: student.name,
      studentId: student.studentId,
      grade: student.grade,
    });
    setEditId(student._id);
  };

  /* ===========================
     DELETE
  =========================== */

  const handleDelete = async (id: string) => {
    setError(null);
    log("Deleting student ID:", id);

    try {
      await api.delete(`/students/${id}`);
      log("Student deleted successfully ✅");
      await fetchStudents();
    } catch (deleteError: any) {
      logError("Delete Error:", deleteError);
      setError(deleteError?.message || "Failed to delete student");
    }
  };

  /* ===========================
     UI
  =========================== */

  return (
    <div className="app">
      <header className="app-header">
        <h1>Student Data Table</h1>
        <p>{status}</p>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="card">
        <h2>{editId ? "Update Student" : "Create Student"}</h2>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Name
            <input
              value={formData.name}
              onChange={(event) =>
                setFormData({ ...formData, name: event.target.value })
              }
              required
            />
          </label>

          <label>
            Student ID
            <input
              value={formData.studentId}
              onChange={(event) =>
                setFormData({ ...formData, studentId: event.target.value })
              }
              required
            />
          </label>

          <label>
            Grade
            <input
              value={formData.grade}
              onChange={(event) =>
                setFormData({ ...formData, grade: event.target.value })
              }
              required
            />
          </label>

          <div className="form-actions">
            <button type="submit">
              {editId ? "Update" : "Create"}
            </button>

            {editId ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  log("Cancel edit");
                  setEditId(null);
                  setFormData({ name: "", studentId: "", grade: "" });
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Students</h2>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Student ID</th>
                <th>Grade</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={4}>No students found.</td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student._id}>
                    <td>{student.name}</td>
                    <td>{student.studentId}</td>
                    <td>{student.grade}</td>
                    <td className="actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleEdit(student)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(student._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default App;