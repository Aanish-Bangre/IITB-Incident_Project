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
  lineCoords: number[] | null
) => {
  return API.post("/job/set-roi-line", {
    job_id: jobId,
    roi_coords: roiCoords,
    line_coords: lineCoords,
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

export default API;
