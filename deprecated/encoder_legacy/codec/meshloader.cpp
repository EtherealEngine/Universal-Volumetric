/*
Corto

Copyright(C) 2017 - Federico Ponchio
ISTI - Italian National Research Council - Visual Computing Lab

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation; either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  You should have received 
a copy of the GNU General Public License along with Corto.
If not, see <http://www.gnu.org/licenses/>.
*/

#include <assert.h>

#include "meshloader.h"
#include "tinyply.h"
#include "objload.h"
#include "point.h"

using namespace crt;
using namespace tinyply;
using namespace std;


static bool endsWith(const std::string& str, const std::string& suffix) {
	return str.size() >= suffix.size() && !str.compare(str.size()-suffix.size(), suffix.size(), suffix);
}

static bool startsWith(const std::string& str, const std::string& prefix) {
	return str.size() >= prefix.size() && !str.compare(0, prefix.size(), prefix);
}

bool MeshLoader::load(const std::string &filename, const string &group) {
		return loadPly(filename);
}


bool MeshLoader::loadPly(const std::string &filename) {
	std::ifstream ss(filename, std::ios::binary);
	if(!ss.is_open())
		return false;
	PlyFile ply(ss);

	cout << "Requesting ply" << endl;

	ply.request_properties_from_element("vertex", { "x", "y", "z" }, coords);

	ply.request_properties_from_element("vertex", { "x0", "x1", "x2", "x3" }, xPos);
	ply.request_properties_from_element("vertex", { "y0", "y1", "y2", "y3" }, yPos);
	ply.request_properties_from_element("vertex", { "z0", "z1", "z2", "z3" }, zPos);

	ply.request_properties_from_element("face", { "vertex_indices" }, index, 3);
	ply.request_properties_from_element("face", { "texcoord" }, wedge_uvs, 6);

	ply.read(ss);
	cout << "coords is" << endl;
	cout << coords.size() / 3 << endl;
	cout << "xPos is " << endl;
	cout << xPos.size() / 4 << endl;
	cout << "yPos is " << endl;
	cout << yPos.size() / 4 << endl;
		cout << "zPos is " << endl;
	cout << zPos.size() / 4 << endl;

	nface = index.size()/3;
	nvert = coords.size()/3;

	if(wedge_uvs.size()){
		cout << " ERROR: Model has UV wedges, please remove before encoding with Meshlab" << endl;
		// splitWedges();
	}

	for(uint32_t i = 0; i < index.size(); i++)
		assert(index[i] < coords.size()/3);

	//create groups:
	groups.push_back(Group(index.size()/3));

	return true;
}

bool MeshLoader::savePly(const string &filename, std::vector<std::string> &comments) {
	std::filebuf fb;
	fb.open(filename, std::ios::out | std::ios::binary);
	if(!fb.is_open())
		return false;
	std::ostream outputStream(&fb);
	PlyFile out;
	// out.comments = comments;

	out.add_properties_to_element("vertex", { "x", "y", "z" }, coords);

	if(xPos.size()){
		cout << "xPoseSize is legit" << endl;
		out.add_properties_to_element("vertex", { "x0", "x1", "x2", "x3" }, xPos);
	}

	if(yPos.size()){
		cout << "yPoseSize is legit" << endl;
		out.add_properties_to_element("vertex", { "y0", "y1", "y2", "y3" }, yPos);
	}

	if(zPos.size()){
		cout << "zPoseSize is legit" << endl;
		out.add_properties_to_element("vertex", { "z0", "z1", "z2", "z3" }, zPos);
	}

	if(uvs.size()) {
		out.add_properties_to_element("vertex", { "texture_u", "texture_v" }, uvs);
	}

	out.add_properties_to_element("face", { "vertex_indices" }, index, 3, PlyProperty::Type::UINT8);

	out.write(outputStream, false);
	fb.close();
	return true;
}

void MeshLoader::addNormals() {

	norms.resize(nvert*3, 0);

	uint32_t *end = index.data() + index.size();
	Point3f *coord = (Point3f *)coords.data();
	Point3f *norm = (Point3f *)norms.data();
	for(uint32_t *f = index.data(); f < end; f += 3) {
		assert(f[0]*3 < coords.size());
		Point3f &p0 = coord[f[0]];
		Point3f &p1 = coord[f[1]];
		Point3f &p2 = coord[f[2]];
		Point3f n = (( p1 - p0) ^ (p2 - p0));
		norm[f[0]] += n+Point3f(10, 10, 10);
		norm[f[1]] += n+Point3f(10, 10, 10);
		norm[f[2]] += n+Point3f(10, 10, 10);
	}
	for(uint32_t i = 0; i < nvert; i++) {
		Point3f &n = norm[i];
		float len = n.norm();
		if(len == 0)
			n = Point3f(0, 0, 1);
		else
			n /= len;
	}
}
