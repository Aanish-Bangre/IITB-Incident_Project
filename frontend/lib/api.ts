import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000",
});

export const uploadVideo = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return API.post("/upload-video", formData);
};

export const getFirstFrame = (jobId: string) => {
  return API.get(`/job/${jobId}/first-frame`, {
    responseType: "blob",
  });
};

export const setROILine = (
  jobId: string,
  roiCoords: number[][] | null,
  lineCoords: number[] | null,
  lineDistanceMeters: number | null = null
) => {
  return API.post("/job/set-roi-line", {
    job_id: jobId,
    roi_coords: roiCoords,
    line_coords: lineCoords,
    line_distance_meters: lineDistanceMeters,
  });
};

export const getJobStatus = (jobId: string) => {
  return API.get(`/job/${jobId}`);
};

export const getJobResults = (jobId: string) => {
  return API.get(`/job/${jobId}/results`);
};

export const getAllJobs = () => {
  return API.get("/jobs");
};

export interface CameraCreatePayload {
  username: string;
  password: string;
  ip_address: string;
  path?: string;
  name?: string;
}

export interface CameraStartPayload {
  roi_coords?: number[][] | null;
  line_coords?: number[] | null;
  line_distance_meters?: number | null;
}

export const createCameraJob = (payload: CameraCreatePayload) => {
  return API.post("/camera-job/create", payload);
};

export const getCameraFirstFrame = (jobId: string) => {
  return API.get(`/camera-job/${jobId}/first-frame`, {
    responseType: "blob",
  });
};

export const startCameraJob = (jobId: string, payload: CameraStartPayload) => {
  return API.post(`/camera-job/${jobId}/start`, payload);
};

export const stopCameraJob = (jobId: string) => {
  return API.post(`/camera-job/${jobId}/stop`);
};

export const getCameraLiveFrameUrl = (jobId: string) => {
  return `${API.defaults.baseURL}/camera-job/${jobId}/live-frame`;
};

export default API;
