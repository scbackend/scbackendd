const getProjectUrl = (id) => { 
    if (!id) {
        throw new Error('Project ID is required');
    }
    return `/project/${id}`;
}

export default getProjectUrl;